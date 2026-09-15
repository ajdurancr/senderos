import { asc } from 'drizzle-orm';
import { openRuntimeDb } from '../../db/client';
import { executionContexts } from '../../db/schema';

export async function listExecutionContexts(home?: string) {
  return await openRuntimeDb(home).select().from(executionContexts).orderBy(asc(executionContexts.name));
}
