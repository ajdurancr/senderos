import { openRuntimeDb } from '../../db/client';
export function listRuns(home?: string) { const db = openRuntimeDb(home); const rows = db.query('select * from runs order by created_at asc').all(); db.close(); return rows; }
