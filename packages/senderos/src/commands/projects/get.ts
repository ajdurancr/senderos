import { openRuntimeDb } from '../../db/client';
import { mapProjectRow } from '../../db/mappers';
import type { ProjectRecord } from '../../shared/types';
export function getProject(id: string, home?: string): ProjectRecord | null { const db = openRuntimeDb(home); const row = mapProjectRow(db.query('select * from projects where id = ?').get(id)); db.close(); return row; }
