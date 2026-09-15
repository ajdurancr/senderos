import { openRuntimeDb } from "../../../db/client";
import { senderoEdges } from "../../../db/schema";
import { emitEvent } from "../../../shared/events";
import { now, randomId } from "../../../shared/ids";
import { getSenderoGraph } from "../get-graph";
import { resolveSenderoAgentNode } from "../resolve-node";

export async function connectSenderoAgents(input: {
  senderoId: string; from: string; to: string; home?: string;
}) {
  const graph = await getSenderoGraph(input.senderoId, undefined, input.home);
  if (!graph) throw new Error(`Sendero not found: ${input.senderoId}`);
  const source = await resolveSenderoAgentNode(graph, input.from, input.home);
  const target = await resolveSenderoAgentNode(graph, input.to, input.home);
  if (source.id === target.id) throw new Error("An agent cannot connect to itself");
  if (graph.edges.some((edge) => edge.sourceNodeId === source.id && edge.targetNodeId === target.id))
    throw new Error(`Sendero connection already exists: ${input.from} -> ${input.to}`);
  const ts = now();
  const record = {
    id: randomId("sendero-edge"), senderoVersionId: graph.version.id,
    sourceNodeId: source.id, targetNodeId: target.id,
    name: `${source.label} to ${target.label}`, description: "",
    transitionObjective: `Continue the Sendero from ${source.label} to ${target.label}.`,
    conditionJson: "{}", status: "active" as const, createdAt: ts, updatedAt: ts,
  };
  const db = openRuntimeDb(input.home);
  await db.insert(senderoEdges).values(record);
  await emitEvent(db, "sendero.agents-connected", "sendero-edge", record.id, {
    senderoId: graph.sendero.id, sourceAgentId: source.agentId, targetAgentId: target.agentId,
  });
  return record;
}
