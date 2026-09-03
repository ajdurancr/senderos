import { openRuntimeDb } from '../../db/client';
import { mapRunAttemptRow } from '../../db/mappers';

export function getRunAttempt(id: string, home?: string) {
  const db = openRuntimeDb(home); const row = mapRunAttemptRow(db.query('select * from run_attempts where id=?').get(id)); db.close(); return row;
}
