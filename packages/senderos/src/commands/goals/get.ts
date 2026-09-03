import { openRuntimeDb } from '../../db/client';
import { mapGoalRow } from '../../db/mappers';

export function getGoal(id: string, home?: string) {
  const db = openRuntimeDb(home); const row = mapGoalRow(db.query('select * from goals where id=?').get(id)); db.close(); return row;
}
