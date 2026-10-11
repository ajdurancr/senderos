import { completionPolicy, preservedNodePolicy, requirementsPolicy } from "../../../internal/senderos/definition-input";
import { requireLifecycle } from "../../../lifecycle/errors";
import { editableGraph } from "../../../lifecycle/versions";
import { eq } from "drizzle-orm";
import { getAgent } from "../../agents/get";
import { getAgentBySlug } from "../../agents/get-by-slug";
import { atomic, openRuntimeDb } from "../../../db/client";
import { senderoEdges, senderoNodes } from "../../../db/schema";
import { emitEvent } from "../../../shared/events";
import { now, randomId } from "../../../shared/ids";
import { resolveSenderoNode } from "../../../internal/senderos/resolve-node";

export async function addAgentToSendero(input: {
  senderoId: string;
  agentId: string;
  from?: string;
  to?: string;
  label?: string;
  executionObjective?: string;
  completion?: { requireReview?: boolean; evidenceKinds?: string[] };
  requirements?: string[];
  home?: string;
}) {
  return atomic(input.home, async () => {
  const graph = await editableGraph(input.senderoId, input.home);
  if (!graph) throw new Error(`Sendero not found: ${input.senderoId}`);
  const agent = (await getAgent(input.agentId, input.home)) ?? (await getAgentBySlug(input.agentId, input.home));
  if (!agent) throw new Error(`Agent not found: ${input.agentId}`);

  const agentNodes = graph.nodes.filter((node) => node.kind === "agent");
  if (agentNodes.length && !input.from && !input.to)
    throw new Error("Adding an agent requires --from, --to, or both");
  const start = graph.nodes.find((node) => node.kind === "start")!;
  const end = graph.nodes.find((node) => node.kind === "end")!;
  const source = input.from ? await resolveSenderoNode(graph, input.from, input.home) : start;
  const target = input.to ? await resolveSenderoNode(graph, input.to, input.home) : end;
  if (source.id === target.id) throw new Error("New agent requires distinct connection points");

  requireLifecycle(source.kind !== 'end' && target.kind !== 'start', 'INVALID_INPUT', 'Connections cannot enter start or leave end');
  requireLifecycle(input.executionObjective === undefined || input.executionObjective.trim().length > 0, 'INVALID_INPUT', 'Execution objective must not be empty');
  requireLifecycle(input.label === undefined || input.label.trim().length > 0, 'INVALID_INPUT', 'Node label must not be empty');
  const ts = now();
  const node = {
    id: randomId("sendero-node"), senderoVersionId: graph.version.id, agentId: agent.id,
    kind: "agent" as const, label: input.label ?? agent.name,
    positionX: Math.round((source.positionX + target.positionX) / 2),
    positionY: Math.round((source.positionY + target.positionY) / 2),
    executionObjective: input.executionObjective ?? agent.defaultGoal ?? `Run ${agent.name}.`,
    completionJson: JSON.stringify(completionPolicy(input.completion ?? {})),
    requirementsJson: JSON.stringify(requirementsPolicy(input.requirements ?? [])),
    joinForkNodeId: null, agentSnapshotJson: null, createdAt: ts, updatedAt: ts,
  };
  const connection = (from: typeof source, to: typeof source) => ({
    id: randomId("sendero-edge"), senderoVersionId: graph.version.id,
    sourceNodeId: from.id, targetNodeId: to.id,
    name: `${from.label} to ${to.label}`, description: "",
    transitionObjective: `Continue the Sendero from ${from.label} to ${to.label}.`,
    conditionJson: "{}", status: "active" as const, createdAt: ts, updatedAt: ts,
  });
  const replacedEdges = graph.edges.filter((edge) => edge.sourceNodeId === source.id && edge.targetNodeId === target.id);
  if (replacedEdges.length > 1) throw new Error('Multiple connections match; use the draft graph editor to choose which route to split');
  const replaced = replacedEdges[0];
  // The original edge governs the source agent. Keep its routing and legacy policy on the incoming segment.
  const incoming = replaced ? { ...replaced, id: randomId('sendero-edge'), targetNodeId: node.id, updatedAt: ts } : connection(source, node);
  const outgoing = connection(node, target);
  const db = openRuntimeDb(input.home);
  await db.update(senderoNodes).set(preservedNodePolicy(graph, source)).where(eq(senderoNodes.id, source.id));
  if (replaced) await db.delete(senderoEdges).where(eq(senderoEdges.id, replaced.id));
  await db.insert(senderoNodes).values(node);
  await db.insert(senderoEdges).values([incoming, outgoing]);
  await emitEvent(db, "sendero.agent-added", "sendero-node", node.id, {
    senderoId: graph.sendero.id, agentId: agent.id,
    fromAgentId: source.agentId, toAgentId: target.agentId,
  });
  return { agent: node, connections: [incoming, outgoing], replacedConnectionId: replaced?.id ?? null };
  });
}
