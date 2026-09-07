import { openRuntimeDb } from '../../db/client';
import { emitEvent } from '../../shared/events';
import { now, randomId } from '../../shared/ids';
import type { GoalRecord } from '../../shared/types';
import { getRun } from './get';
import { sql } from 'drizzle-orm';
export async function createRunRecord(goal: GoalRecord, home?: string) {
  const db = openRuntimeDb(home);
  const id = randomId('run');
  const ts = now();
  await db.run(sql`insert into runs (id,goal_id,status,branch_name,base_branch,max_attempts,created_at,updated_at) values (${id},${goal.id},${'executing'},${goal.branchName},${goal.baseTargetBranch},${3},${ts},${ts})`);
  await emitEvent(db, 'run.created', 'run', id, { goalId: goal.id });
  return getRun(id, home);
}
