import { openRuntimeDb } from '../../db/client';
import { mapRunAttemptRow } from '../../db/mappers';
import type { RunAttemptRecord } from '../../shared/types';
import { sql } from 'drizzle-orm';

export async function listRunAttempts(
  runId?: string,
  home?: string,
): Promise<RunAttemptRecord[]> {
  const db = openRuntimeDb(home);
  const rows = (await (
    runId
      ? db.all(sql`select * from run_attempts where run_id=${runId} order by attempt_number asc`)
      : db.all(sql`select * from run_attempts order by created_at asc`)
  )).map(mapRunAttemptRow) as RunAttemptRecord[];
  return rows;
}
