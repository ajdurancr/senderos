import { openRuntimeDb } from '../../db/client';
import { mapProjectRow } from '../../db/mappers';
import type { ProjectRecord } from '../../shared/types';
export function listProjects(home?: string): ProjectRecord[] {
  const db = openRuntimeDb(home);
  const rows = db
    .query('select * from projects order by created_at asc')
    .all()
    .map(mapProjectRow) as ProjectRecord[];
  db.close();
  return rows;
}
