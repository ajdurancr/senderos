import { openRuntimeDb } from '../../db/client';
import { emitEvent } from '../../shared/events';
import { now } from '../../shared/ids';
import { getGoal } from './get';
import { goals } from '../../db/schema';
import { eq } from 'drizzle-orm';

export async function activateGoal(id: string, home?: string) {
  if (!(await getGoal(id, home))) throw new Error(`Goal not found: ${id}`);
  const db = openRuntimeDb(home);
  await db.update(goals).set({ status: 'active', updatedAt: now() }).where(eq(goals.id, id));
  await emitEvent(db, 'goal.activated', 'goal', id, {});
  return getGoal(id, home);
}
