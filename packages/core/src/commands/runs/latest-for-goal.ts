import { openRuntimeDb } from '../../db/client';
import { runs } from '../../db/schema';
import type { RunRecord } from '../../shared/types';
import { desc, eq } from 'drizzle-orm';
export async function latestRunForGoal(
  goalId: string,
  home?: string,
): Promise<RunRecord | null> {
  const db = openRuntimeDb(home);
  const row = (await db.select().from(runs).where(eq(runs.goalId, goalId)).orderBy(desc(runs.createdAt)).limit(1))[0];
  return row ? { id: row.id, goal_id: row.goalId, status: row.status as RunRecord['status'], branch_name: row.branchName, base_branch: row.baseBranch, max_attempts: row.maxAttempts, created_at: row.createdAt, updated_at: row.updatedAt } : null;
}
