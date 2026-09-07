import { openRuntimeDb } from '../../db/client';
import { mapProjectRow } from '../../db/mappers';
import type { ProjectRecord } from '../../shared/types';
import { sql } from 'drizzle-orm';
export async function listProjects(home?: string): Promise<ProjectRecord[]> {
  const db = openRuntimeDb(home);
  const rows = (await db.all(sql`select * from projects order by created_at asc`)).map(mapProjectRow) as ProjectRecord[];
  return rows;
}
