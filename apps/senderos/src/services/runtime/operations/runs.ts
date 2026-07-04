import { openRuntimeDb } from '../../../db/client';
import { now } from '../../../utils/common';
import { emitEvent } from '../../events';
import { getRun } from '../../runs';
import { updateRunExecutionByRunId } from '../agents';
import { cancelFeature, getFeature } from '../features';

export function listRuns(home?: string) {
  const db = openRuntimeDb(home);
  const rows = db.query('select * from runs order by created_at asc').all();
  db.close();

  return rows;
}

export function cancelRun(id: string, home?: string) {
  const db = openRuntimeDb(home);
  const run = db.query('select * from runs where id=?').get(id) as any;

  if (!run) {
    db.close();
    throw new Error(`Run not found: ${id}`);
  }

  db.prepare('update runs set status=?, updated_at=? where id=?').run('canceled', now(), id);

  if (run.task_id) {
    db.prepare('update tasks set status=?, updated_at=? where id=?').run(
      'canceled',
      now(),
      run.task_id
    );
  }

  emitEvent(db, 'run.canceled', 'run', id, { cancelScope: 'feature' });
  db.close();

  updateRunExecutionByRunId(
    id,
    {
      status: 'canceled',
      checkpoint: 'run_canceled',
      failureSummary: 'Run canceled by SenderOS.',
      finishedAt: now(),
    },
    home
  );

  const feature = getFeature(run.feature_id, home);
  if (feature) {
    cancelFeature(feature.id, home);
  }

  return getRun(id, home);
}

export function listSessions(home?: string) {
  const db = openRuntimeDb(home);
  const rows = db.query('select * from sessions order by created_at asc').all();
  db.close();

  return rows;
}
