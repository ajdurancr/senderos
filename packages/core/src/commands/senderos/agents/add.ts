import { eq } from "drizzle-orm";
import { getAgent } from "../../agents/get";
import { getAgentBySlug } from "../../agents/get-by-slug";
import { openRuntimeDb } from "../../../db/client";
import { senderoEdges, senderoNodes } from "../../../db/schema";
import { emitEvent } from "../../../shared/events";
import { now, randomId } from "../../../shared/ids";
import { getSenderoGraph } from "../get-graph";
import { resolveSenderoAgentNode } from "../../../internal/senderos/resolve-node";

export async function addAgentToSendero(input: {
  senderoId: string;
  agentId: string;
  from?: string;
  to?: string;
  label?: string;
  home?: string;
}) {
  const graph = await getSenderoGraph(input.senderoId, undefined, input.home);
  if (!graph) throw new Error(`Sendero not found: ${input.senderoId}`);
  const agent = (await getAgent(input.agentId, input.home)) ?? (await getAgentBySlug(input.agentId, input.home));
  if (!agent) throw new Error(`Agent not found: ${input.agentId}`);
  if (graph.nodes.some((node) => node.agentId === agent.id))
    throw new Error(`Agent is already in Sendero: ${agent.slug}`);

  const agentNodes = graph.nodes.filter((node) => node.kind === "agent");
  if (agentNodes.length && !input.from && !input.to)
    throw new Error("Adding an agent requires --from, --to, or both");
  const start = graph.nodes.find((node) => node.kind === "start")!;
  const end = graph.nodes.find((node) => node.kind === "end")!;
  const source = input.from ? await resolveSenderoAgentNode(graph, input.from, input.home) : start;
  const target = input.to ? await resolveSenderoAgentNode(graph, input.to, input.home) : end;
  if (source.id === target.id) throw new Error("New agent requires distinct connection points");

  const ts = now();
  const node = {
    id: randomId("sendero-node"), senderoVersionId: graph.version.id, agentId: agent.id,
    kind: "agent" as const, label: input.label ?? agent.name,
    positionX: Math.round((source.positionX + target.positionX) / 2),
    positionY: Math.round((source.positionY + target.positionY) / 2), createdAt: ts, updatedAt: ts,
  };
  const connection = (from: typeof source, to: typeof source) => ({
    id: randomId("sendero-edge"), senderoVersionId: graph.version.id,
    sourceNodeId: from.id, targetNodeId: to.id,
    name: `${from.label} to ${to.label}`, description: "",
    transitionObjective: `Continue the Sendero from ${from.label} to ${to.label}.`,
    conditionJson: "{}", status: "active" as const, createdAt: ts, updatedAt: ts,
  });
  const incoming = connection(source, node);
  const outgoing = connection(node, target);
  const replaced = graph.edges.find((edge) => edge.sourceNodeId === source.id && edge.targetNodeId === target.id);
  const db = openRuntimeDb(input.home);
  if (replaced) await db.delete(senderoEdges).where(eq(senderoEdges.id, replaced.id));
  await db.insert(senderoNodes).values(node);
  await db.insert(senderoEdges).values([incoming, outgoing]);
  await emitEvent(db, "sendero.agent-added", "sendero-node", node.id, {
    senderoId: graph.sendero.id, agentId: agent.id,
    fromAgentId: source.agentId, toAgentId: target.agentId,
  });
  return { agent: node, connections: [incoming, outgoing], replacedConnectionId: replaced?.id ?? null };
}
