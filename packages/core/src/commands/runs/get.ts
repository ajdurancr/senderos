import { openRuntimeDb } from '../../db/client';
import { runs } from '../../db/schema';
import type { RunRecord } from '../../shared/types';
import { eq } from 'drizzle-orm';
export async function getRun(id: string, home?: string): Promise<RunRecord | null> {
  const db = openRuntimeDb(home);
  const row = (await db.select().from(runs).where(eq(runs.id, id)))[0];
  return row ? { id: row.id, goal_id: row.goalId, status: row.status as RunRecord['status'], branch_name: row.branchName, base_branch: row.baseBranch, max_attempts: row.maxAttempts, created_at: row.createdAt, updated_at: row.updatedAt } : null;
}
