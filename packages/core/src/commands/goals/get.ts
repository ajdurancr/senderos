import { openRuntimeDb } from '../../db/client';
import { mapGoalRow } from '../../db/mappers';
import { goals } from '../../db/schema';
import { eq } from 'drizzle-orm';

export async function getGoal(id: string, home?: string) {
  const db = openRuntimeDb(home);
  const row = mapGoalRow((await db.select().from(goals).where(eq(goals.id, id)))[0]);
  return row;
}
