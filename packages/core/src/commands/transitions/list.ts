import { openRuntimeDb } from '../../db/client';
import { mapAgentTransitionRow } from '../../db/mappers';
import type { AgentTransitionRecord } from '../../shared/types';
import { sql } from 'drizzle-orm';
export async function listAgentTransitions(home?: string): Promise<AgentTransitionRecord[]> {
  const db = openRuntimeDb(home);
  const rows = (await db.all(sql`select * from agent_transitions order by created_at asc`)).map(mapAgentTransitionRow) as AgentTransitionRecord[];
  return rows;
}
