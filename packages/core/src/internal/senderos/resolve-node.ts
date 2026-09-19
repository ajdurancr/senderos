import { getAgent } from "../../commands/agents/get";
import { getAgentBySlug } from "../../commands/agents/get-by-slug";
import type { SenderoGraph, SenderoNodeRecord } from "../../shared/types";

export async function resolveSenderoNode(
  graph: SenderoGraph,
  reference: string,
  home?: string,
): Promise<SenderoNodeRecord> {
  const direct = graph.nodes.filter(
    (node) =>
      node.id === reference ||
      node.kind === reference ||
      node.label.toLowerCase() === reference.toLowerCase(),
  );
  const agent =
    (await getAgent(reference, home)) ?? (await getAgentBySlug(reference, home));
  const matches = agent
    ? [...direct, ...graph.nodes.filter((node) => node.agentId === agent.id)]
    : direct;
  const unique = [...new Map(matches.map((node) => [node.id, node])).values()];
  if (unique.length === 0)
    throw new Error(`Sendero node not found: ${reference}`);
  if (unique.length > 1)
    throw new Error(`Sendero node reference is ambiguous: ${reference}`);
  return unique[0]!;
}

export async function resolveSenderoAgentNode(
  graph: SenderoGraph,
  reference: string,
  home?: string,
) {
  const node = await resolveSenderoNode(graph, reference, home);
  if (node.kind !== "agent")
    throw new Error(`Sendero agent not found: ${reference}`);
  return node;
}
