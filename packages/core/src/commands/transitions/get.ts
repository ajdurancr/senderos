import { openRuntimeDb } from '../../db/client';
import { mapAgentTransitionRow } from '../../db/mappers';
import { agentTransitions } from '../../db/schema';
import { eq } from 'drizzle-orm';
export async function getAgentTransition(id: string, home?: string) {
  const db = openRuntimeDb(home);
  const row = mapAgentTransitionRow((await db.select().from(agentTransitions).where(eq(agentTransitions.id, id)))[0]);
  return row;
}
