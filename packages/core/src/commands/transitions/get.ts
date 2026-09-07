import { openRuntimeDb } from "../../db/client";
import type { AgentTransitionRecord } from "../../shared/types";
import { agentTransitions } from "../../db/schema";
import { eq } from "drizzle-orm";
export async function getAgentTransition(id: string, home?: string) {
  const db = openRuntimeDb(home);
  return (
    ((
      await db
        .select()
        .from(agentTransitions)
        .where(eq(agentTransitions.id, id))
    )[0] as AgentTransitionRecord | undefined) ?? null
  );
}
