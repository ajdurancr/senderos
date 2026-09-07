import { openRuntimeDb } from '../../db/client';
import { mapAgentRow } from '../../db/mappers';
import { sql } from 'drizzle-orm';

export async function getAgentBySlug(slug: string, home?: string) {
  const db = openRuntimeDb(home);
  const agent = mapAgentRow((await db.all(sql`select * from agents where slug=${slug}`))[0]);
  return agent;
}
