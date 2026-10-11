import { jsonObject, preservedNodePolicy } from "../../../internal/senderos/definition-input";
import { editableGraph } from "../../../lifecycle/versions";
import { eq, or } from "drizzle-orm";
import { atomic, openRuntimeDb } from "../../../db/client";
import { senderoEdges, senderoNodes } from "../../../db/schema";
import { emitEvent } from "../../../shared/events";
import { now, randomId } from "../../../shared/ids";
import { resolveSenderoAgentNode } from "../../../internal/senderos/resolve-node";

export async function removeAgentFromSendero(input: { senderoId: string; agentId: string; home?: string }) {
  return atomic(input.home, async () => {
  const graph = await editableGraph(input.senderoId, input.home);
  if (!graph) throw new Error(`Sendero not found: ${input.senderoId}`);
  const node = await resolveSenderoAgentNode(graph, input.agentId, input.home);
  const incoming = graph.edges.filter((edge) => edge.targetNodeId === node.id);
  const outgoing = graph.edges.filter((edge) => edge.sourceNodeId === node.id);
  if (graph.nodes.some(candidate => candidate.joinForkNodeId === node.id))
    throw new Error('This node is paired with a join; update the complete draft graph to remove the pairing explicitly');
  if (outgoing.some(edge => Object.keys(jsonObject(edge.conditionJson, 'Connection condition')).some(key => key !== 'completion')))
    throw new Error('Removing a conditional routing node requires an explicit replacement draft graph');
  const ts = now();
  const reconnected = incoming.flatMap((before) =>
    outgoing
      .filter((after) => before.sourceNodeId !== node.id && after.targetNodeId !== node.id)
      .filter((after) => !graph.edges.some((edge) => edge.sourceNodeId === before.sourceNodeId && edge.targetNodeId === after.targetNodeId))
      .map((after) => ({
        id: randomId("sendero-edge"), senderoVersionId: graph.version.id,
        sourceNodeId: before.sourceNodeId, targetNodeId: after.targetNodeId,
        name: `${before.name} / ${after.name}`, description: before.description,
        transitionObjective: before.transitionObjective,
        conditionJson: before.conditionJson, status: before.status, createdAt: ts, updatedAt: ts,
      })),
  );
  const db = openRuntimeDb(input.home);
  for (const sourceId of new Set(incoming.map(edge => edge.sourceNodeId))) {
    const source = graph.nodes.find(candidate => candidate.id === sourceId)!;
    await db.update(senderoNodes).set(preservedNodePolicy(graph, source)).where(eq(senderoNodes.id, source.id));
  }
  await db.delete(senderoEdges).where(or(eq(senderoEdges.sourceNodeId, node.id), eq(senderoEdges.targetNodeId, node.id)));
  if (reconnected.length) await db.insert(senderoEdges).values(reconnected);
  await db.delete(senderoNodes).where(eq(senderoNodes.id, node.id));
  await emitEvent(db, "sendero.agent-removed", "sendero-node", node.id, {
    senderoId: graph.sendero.id, agentId: node.agentId,
    removedConnections: incoming.length + outgoing.length, createdConnections: reconnected.length,
  });
  return { agent: node, removedConnections: incoming.length + outgoing.length, connections: reconnected };
  });
}
