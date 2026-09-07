import { openRuntimeDb } from "../../db/client";
import type { AgentRecord } from "../../shared/types";
import { agents } from "../../db/schema";
import { eq } from "drizzle-orm";

export async function getAgentBySlug(slug: string, home?: string) {
  const db = openRuntimeDb(home);
  return (
    ((await db.select().from(agents).where(eq(agents.slug, slug)))[0] as
      | AgentRecord
      | undefined) ?? null
  );
}
