import { openRuntimeDb } from '../../db/client';
import { mapGoalRow } from '../../db/mappers';
import { sql } from 'drizzle-orm';

export async function getGoal(id: string, home?: string) {
  const db = openRuntimeDb(home);
  const row = mapGoalRow((await db.all(sql`select * from goals where id=${id}`))[0]);
  return row;
}
