import { openRuntimeDb } from '../../db/client';
import { emitEvent } from '../../shared/events';
import { now } from '../../shared/ids';
import { getGoal } from './get';

export function cancelGoal(id: string, home?: string) {
  if (!getGoal(id, home)) throw new Error(`Goal not found: ${id}`);
  const db = openRuntimeDb(home);
  const ts = now();
  db.prepare("update goals set status='canceled',updated_at=? where id=?").run(
    ts,
    id,
  );
  db.prepare(
    "update runs set status='canceled',updated_at=? where goal_id=? and status not in ('succeeded','failed','canceled')",
  ).run(ts, id);
  db.prepare(
    "update run_attempts set status='canceled',finished_at=?,updated_at=? where run_id in (select id from runs where goal_id=?) and status in ('queued','running','paused')",
  ).run(ts, ts, id);
  emitEvent(db, 'goal.canceled', 'goal', id, {});
  db.close();
  return getGoal(id, home);
}
