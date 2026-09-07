import { openRuntimeDb } from '../../db/client';
import { emitEvent } from '../../shared/events';
import { now } from '../../shared/ids';
import { getGoal } from './get';
import { sql } from 'drizzle-orm';

export async function cancelGoal(id: string, home?: string) {
  if (!(await getGoal(id, home))) throw new Error(`Goal not found: ${id}`);
  const db = openRuntimeDb(home);
  const ts = now();
  await db.run(sql`update goals set status='canceled',updated_at=${ts} where id=${id}`);
  await db.run(sql`update runs set status='canceled',updated_at=${ts} where goal_id=${id} and status not in ('succeeded','failed','canceled')`);
  await db.run(sql`update run_attempts set status='canceled',finished_at=${ts},updated_at=${ts} where run_id in (select id from runs where goal_id=${id}) and status in ('queued','running','paused')`);
  await emitEvent(db, 'goal.canceled', 'goal', id, {});
  return getGoal(id, home);
}
