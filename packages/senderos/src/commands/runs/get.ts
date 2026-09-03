import { openRuntimeDb } from '../../db/client';
import type { RunRecord } from '../../shared/types';
export function getRun(id: string, home?: string): RunRecord | null { const db = openRuntimeDb(home); const row = db.query('select * from runs where id=?').get(id); db.close(); return (row as RunRecord | null) ?? null; }
