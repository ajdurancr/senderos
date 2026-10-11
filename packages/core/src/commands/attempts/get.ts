import { openRuntimeDb } from '../../db/client';
import type { RunAttemptRecord } from '../../shared/types';
import { runAttempts } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { canReadAttempt, inspectAttempt } from './inspection';

export async function getRunAttempt(id: string, home?: string, executionContextId?: string) {
  const attempt = (await openRuntimeDb(home).select().from(runAttempts).where(eq(runAttempts.id, id)))[0] as RunAttemptRecord | undefined;
  if (!attempt || (executionContextId && !(await canReadAttempt(attempt, executionContextId, home)))) return null;
  return inspectAttempt(attempt, home);
}
