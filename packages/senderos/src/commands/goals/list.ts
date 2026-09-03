import { openRuntimeDb } from '../../db/client';
import { mapGoalRow } from '../../db/mappers';
import type { GoalRecord } from '../../shared/types';

export function listGoals(home?: string): GoalRecord[] {
  const db = openRuntimeDb(home); const rows = db.query('select * from goals order by created_at asc').all().map(mapGoalRow) as GoalRecord[]; db.close(); return rows;
}
