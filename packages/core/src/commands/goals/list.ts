import { openRuntimeDb } from '../../db/client';
import { mapGoalRow } from '../../db/mappers';
import type { GoalRecord } from '../../shared/types';
import { sql } from 'drizzle-orm';

export async function listGoals(home?: string): Promise<GoalRecord[]> {
  const db = openRuntimeDb(home);
  const rows = (await db.all(sql`select * from goals order by created_at asc`)).map(mapGoalRow) as GoalRecord[];
  return rows;
}
