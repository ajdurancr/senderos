import { openRuntimeDb } from '../../db/client';
import { mapRunAttemptRow } from '../../db/mappers';
import { sql } from 'drizzle-orm';

export async function getRunAttempt(id: string, home?: string) {
  const db = openRuntimeDb(home);
  const row = mapRunAttemptRow((await db.all(sql`select * from run_attempts where id=${id}`))[0]);
  return row;
}
