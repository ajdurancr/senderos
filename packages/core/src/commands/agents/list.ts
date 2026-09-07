import { openRuntimeDb } from '../../db/client';
import { mapAgentRow } from '../../db/mappers';
import { agents } from '../../db/schema';
import type { AgentRecord } from '../../shared/types';
import { asc } from 'drizzle-orm';

export async function listAgents(home?: string): Promise<AgentRecord[]> {
  const db = openRuntimeDb(home);
  const rows = (await db.select().from(agents).orderBy(asc(agents.createdAt))).map(mapAgentRow) as AgentRecord[];
  return rows;
}
