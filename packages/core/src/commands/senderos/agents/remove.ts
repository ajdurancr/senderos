import { eq, or } from "drizzle-orm";
import { openRuntimeDb } from "../../../db/client";
import { senderoEdges, senderoNodes } from "../../../db/schema";
import { emitEvent } from "../../../shared/events";
import { getSenderoGraph } from "../get-graph";
import { resolveSenderoNode } from "../resolve-node";

export async function removeAgentFromSendero(input: {
  senderoId: string;
  agentId: string;
  home?: string;
}) {
  const graph = await getSenderoGraph(input.senderoId, undefined, input.home);
  if (!graph) throw new Error(`Sendero not found: ${input.senderoId}`);
  const node = await resolveSenderoNode(graph, input.agentId, input.home);
  if (node.kind !== "agent")
    throw new Error("Only agent nodes can be removed from a Sendero");
  const db = openRuntimeDb(input.home);
  const connections = graph.edges.filter(
    (edge) => edge.sourceNodeId === node.id || edge.targetNodeId === node.id,
  );
  await db
    .delete(senderoEdges)
    .where(
      or(eq(senderoEdges.sourceNodeId, node.id), eq(senderoEdges.targetNodeId, node.id)),
    );
  await db.delete(senderoNodes).where(eq(senderoNodes.id, node.id));
  await emitEvent(db, "sendero.agent-removed", "sendero-node", node.id, {
    senderoId: graph.sendero.id,
    agentId: node.agentId,
    removedConnections: connections.length,
  });
  return { node, removedConnections: connections.length };
}
