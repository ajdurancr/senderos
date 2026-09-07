import { openRuntimeDb } from "../../db/client";
import { agentTransitions } from "../../db/schema";
import type { AgentTransitionRecord } from "../../shared/types";
import { asc } from "drizzle-orm";
export async function listAgentTransitions(
  home?: string,
): Promise<AgentTransitionRecord[]> {
  const db = openRuntimeDb(home);
  return (await db
    .select()
    .from(agentTransitions)
    .orderBy(asc(agentTransitions.createdAt))) as AgentTransitionRecord[];
}
