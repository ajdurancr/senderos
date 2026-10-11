import { eq } from "drizzle-orm";
import { jsonObject, preservedNodePolicy } from "../../../internal/senderos/definition-input";
import { editableGraph } from "../../../lifecycle/versions";
import { atomic, openRuntimeDb } from "../../../db/client";
import { senderoEdges, senderoNodes } from "../../../db/schema";
import { emitEvent } from "../../../shared/events";
import { now, randomId } from "../../../shared/ids";
import { resolveSenderoNode } from "../../../internal/senderos/resolve-node";

export async function connectSenderoAgents(input: {
  senderoId: string; from: string; to: string; condition?: Record<string, unknown>; name?: string; home?: string;
}) {
  return atomic(input.home, async () => {
  const graph = await editableGraph(input.senderoId, input.home);
  if (!graph) throw new Error(`Sendero not found: ${input.senderoId}`);
  const source = await resolveSenderoNode(graph, input.from, input.home);
  const target = await resolveSenderoNode(graph, input.to, input.home);
  if (source.kind === 'end' || target.kind === 'start') throw new Error('Connections cannot enter start or leave end');
  const conditionJson = JSON.stringify(jsonObject(input.condition ?? {}, 'Connection condition'));
  if (graph.edges.some((edge) => edge.sourceNodeId === source.id && edge.targetNodeId === target.id && edge.conditionJson === conditionJson))
    throw new Error(`Sendero connection already exists: ${input.from} -> ${input.to}`);
  const ts = now();
  const record = {
    id: randomId("sendero-edge"), senderoVersionId: graph.version.id,
    sourceNodeId: source.id, targetNodeId: target.id,
    name: input.name ?? `${source.label} to ${target.label}`, description: "",
    transitionObjective: `Continue the Sendero from ${source.label} to ${target.label}.`,
    conditionJson, status: "active" as const, createdAt: ts, updatedAt: ts,
  };
  const db = openRuntimeDb(input.home);
  await db.update(senderoNodes).set(preservedNodePolicy(graph, source)).where(eq(senderoNodes.id, source.id));
  await db.insert(senderoEdges).values(record);
  await emitEvent(db, "sendero.agents-connected", "sendero-edge", record.id, {
    senderoId: graph.sendero.id, sourceAgentId: source.agentId, targetAgentId: target.agentId,
  });
  return record;
  });
}
