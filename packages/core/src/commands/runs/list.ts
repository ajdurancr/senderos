import { openRuntimeDb } from '../../db/client';
import { runs } from '../../db/schema';
import { asc } from 'drizzle-orm';
import type { RunRecord } from '../../shared/types';
export async function listRuns(home?: string) {
  const db = openRuntimeDb(home);
  const rows = await db.select().from(runs).orderBy(asc(runs.createdAt));
  return rows.map((row) => ({ id: row.id, goal_id: row.goalId, status: row.status as RunRecord['status'], branch_name: row.branchName, base_branch: row.baseBranch, max_attempts: row.maxAttempts, created_at: row.createdAt, updated_at: row.updatedAt }));
}
