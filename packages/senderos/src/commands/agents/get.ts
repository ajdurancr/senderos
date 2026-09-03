import { openRuntimeDb } from '../../db/client';
import { mapAgentRow } from '../../db/mappers';

export function getAgent(id: string, home?: string) {
  const db = openRuntimeDb(home);
  const agent = mapAgentRow(db.query('select * from agents where id=?').get(id));
  db.close();
  return agent;
}
