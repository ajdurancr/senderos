import { openRuntimeDb } from '../../db/client';
import { mapAgentTransitionRow } from '../../db/mappers';
import { agentTransitions } from '../../db/schema';
import type { AgentTransitionRecord } from '../../shared/types';
import { asc } from 'drizzle-orm';
export async function listAgentTransitions(home?: string): Promise<AgentTransitionRecord[]> {
  const db = openRuntimeDb(home);
  const rows = (await db.select().from(agentTransitions).orderBy(asc(agentTransitions.createdAt))).map(mapAgentTransitionRow) as AgentTransitionRecord[];
  return rows;
}
