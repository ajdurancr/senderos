import { openRuntimeDb } from '../../db/client';
import { mapRunAttemptRow } from '../../db/mappers';
import { runAttempts } from '../../db/schema';
import type { RunAttemptRecord } from '../../shared/types';
import { asc, eq } from 'drizzle-orm';

export async function listRunAttempts(
  runId?: string,
  home?: string,
): Promise<RunAttemptRecord[]> {
  const db = openRuntimeDb(home);
  const query = db.select().from(runAttempts);
  const rows = (await (runId
    ? query.where(eq(runAttempts.runId, runId)).orderBy(asc(runAttempts.attemptNumber))
    : query.orderBy(asc(runAttempts.createdAt)))).map(mapRunAttemptRow) as RunAttemptRecord[];
  return rows;
}
