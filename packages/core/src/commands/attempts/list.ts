import { openRuntimeDb } from '../../db/client';
import { runAttempts } from '../../db/schema';
import type { RunAttemptRecord } from '../../shared/types';
import { asc, eq } from 'drizzle-orm';
import { canReadAttempt, inspectAttempt } from './inspection';

export async function listRunAttempts(runId?: string, home?: string, executionContextId?: string) {
  const query = openRuntimeDb(home).select().from(runAttempts);
  const rows = await (runId ? query.where(eq(runAttempts.runId, runId)).orderBy(asc(runAttempts.attemptNumber)) : query.orderBy(asc(runAttempts.createdAt))) as RunAttemptRecord[];
  const result = [];
  for (const attempt of rows) {
    if (!executionContextId || await canReadAttempt(attempt, executionContextId, home)) result.push(await inspectAttempt(attempt, home));
  }
  return result;
}
