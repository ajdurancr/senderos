import { openRuntimeDb } from '../../db/client';
import type { RunRecord } from '../../shared/types';
import { sql } from 'drizzle-orm';
export async function getRun(id: string, home?: string): Promise<RunRecord | null> {
  const db = openRuntimeDb(home);
  const row = (await db.all(sql`select * from runs where id=${id}`))[0];
  return (row as RunRecord | null) ?? null;
}
