import { openRuntimeDb } from '../../db/client';
import type { RunRecord } from '../../shared/types';
export function latestRunForGoal(
  goalId: string,
  home?: string,
): RunRecord | null {
  const db = openRuntimeDb(home);
  const row = db
    .query(
      'select * from runs where goal_id=? order by created_at desc limit 1',
    )
    .get(goalId);
  db.close();
  return (row as RunRecord | null) ?? null;
}
