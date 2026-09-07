import { openRuntimeDb } from '../../db/client';
import { mapProjectRow } from '../../db/mappers';
import type { ProjectRecord } from '../../shared/types';
import { sql } from 'drizzle-orm';
export async function getProject(id: string, home?: string): Promise<ProjectRecord | null> {
  const db = openRuntimeDb(home);
  const row = mapProjectRow((await db.all(sql`select * from projects where id=${id}`))[0]);
  return row;
}
