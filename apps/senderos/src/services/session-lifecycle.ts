import { openRuntimeDb } from '../db/client';
import { now } from '../utils/common';
import { emitEvent } from './events';
import { updateAgentRunByRunId } from './runtime/agents';

export function completeActiveSessionsForFeature(
  featureId: string,
  home?: string,
  reason = 'phase_completed'
) {
  const db = openRuntimeDb(home);
  const sessions = db
    .query(
      "select sessions.id, sessions.run_id from sessions join runs on runs.id = sessions.run_id where runs.feature_id = ? and sessions.status = 'active'"
    )
    .all(featureId) as Array<{ id: string; run_id: string | null }>;

  for (const session of sessions) {
    db.prepare("update sessions set status='completed', updated_at=? where id=?").run(now(), session.id);
    emitEvent(db, 'session.completed', 'session', session.id, { reason });

    if (session.run_id) {
      updateAgentRunByRunId(
        session.run_id,
        {
          status: 'succeeded',
          checkpoint: reason,
          finishedAt: now(),
        },
        home
      );
    }
  }

  db.close();
}
