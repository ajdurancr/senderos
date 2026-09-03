import { openRuntimeDb } from '../../db/client';
import { mapAgentRow } from '../../db/mappers';

export function getAgentBySlug(slug: string, home?: string) {
  const db = openRuntimeDb(home);
  const agent = mapAgentRow(db.query('select * from agents where slug=?').get(slug));
  db.close();
  return agent;
}
