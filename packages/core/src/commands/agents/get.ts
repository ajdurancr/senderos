import { openRuntimeDb } from "../../db/client";
import type { AgentRecord } from "../../shared/types";
import { agents } from "../../db/schema";
import { eq } from "drizzle-orm";

export async function getAgent(id: string, home?: string) {
  const db = openRuntimeDb(home);
  return (
    ((await db.select().from(agents).where(eq(agents.id, id)))[0] as
      | AgentRecord
      | undefined) ?? null
  );
}
