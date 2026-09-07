import { openRuntimeDb } from '../../db/client';
import { mapGoalRow } from '../../db/mappers';
import { goals } from '../../db/schema';
import type { GoalRecord } from '../../shared/types';
import { asc } from 'drizzle-orm';

export async function listGoals(home?: string): Promise<GoalRecord[]> {
  const db = openRuntimeDb(home);
  const rows = (await db.select().from(goals).orderBy(asc(goals.createdAt))).map(mapGoalRow) as GoalRecord[];
  return rows;
}
