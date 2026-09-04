import { openRuntimeDb } from '../../db/client';
import { mapAgentRow } from '../../db/mappers';
import type { AgentRecord } from '../../shared/types';

export function listAgents(home?: string): AgentRecord[] {
  const db = openRuntimeDb(home);
  const agents = db
    .query('select * from agents order by created_at asc')
    .all()
    .map(mapAgentRow) as AgentRecord[];
  db.close();
  return agents;
}
