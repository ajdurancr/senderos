import { openRuntimeDb } from '../../db/client';
import { mapAgentTransitionRow } from '../../db/mappers';
import { sql } from 'drizzle-orm';
export async function getAgentTransition(id: string, home?: string) {
  const db = openRuntimeDb(home);
  const row = mapAgentTransitionRow((await db.all(sql`select * from agent_transitions where id=${id}`))[0]);
  return row;
}
