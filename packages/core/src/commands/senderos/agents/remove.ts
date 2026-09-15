import { eq, or } from "drizzle-orm";
import { openRuntimeDb } from "../../../db/client";
import { senderoEdges, senderoNodes } from "../../../db/schema";
import { emitEvent } from "../../../shared/events";
import { now, randomId } from "../../../shared/ids";
import { getSenderoGraph } from "../get-graph";
import { resolveSenderoAgentNode } from "../resolve-node";

export async function removeAgentFromSendero(input: { senderoId: string; agentId: string; home?: string }) {
  const graph = await getSenderoGraph(input.senderoId, undefined, input.home);
  if (!graph) throw new Error(`Sendero not found: ${input.senderoId}`);
  const node = await resolveSenderoAgentNode(graph, input.agentId, input.home);
  const incoming = graph.edges.filter((edge) => edge.targetNodeId === node.id);
  const outgoing = graph.edges.filter((edge) => edge.sourceNodeId === node.id);
  const ts = now();
  const reconnected = incoming.flatMap((before) =>
    outgoing
      .filter((after) => before.sourceNodeId !== after.targetNodeId)
      .filter((after) => !graph.edges.some((edge) => edge.sourceNodeId === before.sourceNodeId && edge.targetNodeId === after.targetNodeId))
      .map((after) => ({
        id: randomId("sendero-edge"), senderoVersionId: graph.version.id,
        sourceNodeId: before.sourceNodeId, targetNodeId: after.targetNodeId,
        name: `${before.name} / ${after.name}`, description: "",
        transitionObjective: after.transitionObjective,
        conditionJson: after.conditionJson, status: "active" as const, createdAt: ts, updatedAt: ts,
      })),
  );
  const db = openRuntimeDb(input.home);
  await db.delete(senderoEdges).where(or(eq(senderoEdges.sourceNodeId, node.id), eq(senderoEdges.targetNodeId, node.id)));
  if (reconnected.length) await db.insert(senderoEdges).values(reconnected);
  await db.delete(senderoNodes).where(eq(senderoNodes.id, node.id));
  await emitEvent(db, "sendero.agent-removed", "sendero-node", node.id, {
    senderoId: graph.sendero.id, agentId: node.agentId,
    removedConnections: incoming.length + outgoing.length, createdConnections: reconnected.length,
  });
  return { agent: node, removedConnections: incoming.length + outgoing.length, connections: reconnected };
}
