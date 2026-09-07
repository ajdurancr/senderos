import { openRuntimeDb } from "../../db/client";
import { agents } from "../../db/schema";
import type { AgentRecord } from "../../shared/types";
import { asc } from "drizzle-orm";

export async function listAgents(home?: string): Promise<AgentRecord[]> {
  const db = openRuntimeDb(home);
  return (await db
    .select()
    .from(agents)
    .orderBy(asc(agents.createdAt))) as AgentRecord[];
}
