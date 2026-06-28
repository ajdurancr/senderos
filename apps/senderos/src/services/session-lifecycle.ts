import { openConfiguredCommandDb } from '../db/client';
import { now } from '../utils/common';
import { emitEvent } from './events';

export function completeActiveSessionsForFeature(
  featureId: string,
  home?: string,
  reason = 'phase_completed'
) {
  const db = openConfiguredCommandDb(home);
  const sessions = db
    .query(
      "select sessions.id from sessions join runs on runs.id = sessions.run_id where runs.feature_id = ? and sessions.status = 'active'"
    )
    .all(featureId) as Array<{ id: string }>;

  for (const session of sessions) {
    db.prepare("update sessions set status='completed', updated_at=? where id=?").run(now(), session.id);
    emitEvent(db, 'session.completed', 'session', session.id, { reason });
  }

  db.close();
}
