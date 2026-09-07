import { openRuntimeDb } from '../../db/client';
import { sql } from 'drizzle-orm';
import type { RunRecord } from '../../shared/types';
export async function listRuns(home?: string) {
  const db = openRuntimeDb(home);
  const rows = await db.all(sql`select * from runs order by created_at asc`);
  return rows as RunRecord[];
}
