import { openRuntimeDb } from '../../db/client';
import { emitEvent } from '../../shared/events';
import { now } from '../../shared/ids';
import { getGoal } from './get';

export function activateGoal(id: string, home?: string) {
  if (!getGoal(id, home)) throw new Error(`Goal not found: ${id}`); const db = openRuntimeDb(home);
  db.prepare("update goals set status='active',updated_at=? where id=?").run(now(), id); emitEvent(db, 'goal.activated', 'goal', id, {}); db.close(); return getGoal(id, home);
}
