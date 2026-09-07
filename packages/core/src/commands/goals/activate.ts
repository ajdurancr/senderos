import { openRuntimeDb } from '../../db/client';
import { emitEvent } from '../../shared/events';
import { now } from '../../shared/ids';
import { getGoal } from './get';
import { sql } from 'drizzle-orm';

export async function activateGoal(id: string, home?: string) {
  if (!(await getGoal(id, home))) throw new Error(`Goal not found: ${id}`);
  const db = openRuntimeDb(home);
  await db.run(sql`update goals set status='active',updated_at=${now()} where id=${id}`);
  await emitEvent(db, 'goal.activated', 'goal', id, {});
  return getGoal(id, home);
}
