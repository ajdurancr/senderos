import { requireDraft } from "../../lifecycle/versions";
import { eq } from "drizzle-orm";

import { atomic, openRuntimeDb } from "../../db/client";
import { senderoEdges } from "../../db/schema";
import { emitEvent } from "../../shared/events";
import { now } from "../../shared/ids";
import type { AgentTransitionStatus } from "../../shared/types";

export async function updateSenderoEdge(input: {
  id: string;
  name?: string;
  description?: string;
  transitionObjective?: string;
  completion?: { requireReview?: boolean; evidenceKinds?: string[] };
  status?: AgentTransitionStatus;
  home?: string;
}) {
  return atomic(input.home, async () => {
  const db = openRuntimeDb(input.home);
  const edge = (
    await db.select().from(senderoEdges).where(eq(senderoEdges.id, input.id))
  )[0];

  if (!edge) throw new Error(`Sendero edge not found: ${input.id}`);

  await requireDraft(edge.senderoVersionId, input.home);
  const changes = {
    conditionJson: input.completion === undefined ? edge.conditionJson : JSON.stringify({ completion: input.completion }),
    name: input.name ?? edge.name,
    description: input.description ?? edge.description,
    transitionObjective: input.transitionObjective ?? edge.transitionObjective,
    status: input.status ?? edge.status,
    updatedAt: now(),
  };
  await db
    .update(senderoEdges)
    .set(changes)
    .where(eq(senderoEdges.id, input.id));

  await emitEvent(db, "sendero.edge-updated", "sendero-edge", input.id, {
    name: input.name,
    status: input.status,
  });
  return (
    await db.select().from(senderoEdges).where(eq(senderoEdges.id, input.id))
  )[0];
  });
}
