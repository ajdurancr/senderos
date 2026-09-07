import { openRuntimeDb } from '../../db/client';
import { mapAgentRow } from '../../db/mappers';
import { sql } from 'drizzle-orm';

export async function getAgent(id: string, home?: string) {
  const db = openRuntimeDb(home);
  const agent = mapAgentRow((await db.all(sql`select * from agents where id=${id}`))[0]);
  return agent;
}
