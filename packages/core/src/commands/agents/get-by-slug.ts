import { openRuntimeDb } from '../../db/client';
import { mapAgentRow } from '../../db/mappers';
import { agents } from '../../db/schema';
import { eq } from 'drizzle-orm';

export async function getAgentBySlug(slug: string, home?: string) {
  const db = openRuntimeDb(home);
  const agent = mapAgentRow((await db.select().from(agents).where(eq(agents.slug, slug)))[0]);
  return agent;
}
