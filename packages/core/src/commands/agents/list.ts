import { openRuntimeDb } from '../../db/client';
import { mapAgentRow } from '../../db/mappers';
import type { AgentRecord } from '../../shared/types';
import { sql } from 'drizzle-orm';

export async function listAgents(home?: string): Promise<AgentRecord[]> {
  const db = openRuntimeDb(home);
  const agents = (await db.all(sql`select * from agents order by created_at asc`)).map(mapAgentRow) as AgentRecord[];
  return agents;
}
