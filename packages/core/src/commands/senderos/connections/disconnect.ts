import { eq } from "drizzle-orm";
import { openRuntimeDb } from "../../../db/client";
import { senderoEdges } from "../../../db/schema";
import { emitEvent } from "../../../shared/events";
import { getSenderoGraph } from "../get-graph";
import { resolveSenderoNode } from "../resolve-node";

export async function disconnectSenderoNodes(input: {
  senderoId: string;
  from: string;
  to: string;
  home?: string;
}) {
  const graph = await getSenderoGraph(input.senderoId, undefined, input.home);
  if (!graph) throw new Error(`Sendero not found: ${input.senderoId}`);
  const source = await resolveSenderoNode(graph, input.from, input.home);
  const target = await resolveSenderoNode(graph, input.to, input.home);
  const matches = graph.edges.filter(
    (edge) => edge.sourceNodeId === source.id && edge.targetNodeId === target.id,
  );
  if (matches.length === 0)
    throw new Error(`Sendero connection not found: ${input.from} -> ${input.to}`);
  if (matches.length > 1)
    throw new Error(`Multiple Sendero connections match: ${input.from} -> ${input.to}`);
  const edge = matches[0]!;
  const db = openRuntimeDb(input.home);
  await db.delete(senderoEdges).where(eq(senderoEdges.id, edge.id));
  await emitEvent(db, "sendero.disconnected", "sendero-edge", edge.id, {
    senderoId: graph.sendero.id,
    sourceNodeId: source.id,
    targetNodeId: target.id,
  });
  return edge;
}
