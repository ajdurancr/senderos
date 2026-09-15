import { getAgent } from "../../agents/get";
import { getAgentBySlug } from "../../agents/get-by-slug";
import { openRuntimeDb } from "../../../db/client";
import { senderoNodes } from "../../../db/schema";
import { emitEvent } from "../../../shared/events";
import { now, randomId } from "../../../shared/ids";
import { getSenderoGraph } from "../get-graph";

export async function addAgentToSendero(input: {
  senderoId: string;
  agentId: string;
  label?: string;
  home?: string;
}) {
  const graph = await getSenderoGraph(input.senderoId, undefined, input.home);
  if (!graph) throw new Error(`Sendero not found: ${input.senderoId}`);
  const agent =
    (await getAgent(input.agentId, input.home)) ??
    (await getAgentBySlug(input.agentId, input.home));
  if (!agent) throw new Error(`Agent not found: ${input.agentId}`);
  if (graph.nodes.some((node) => node.agentId === agent.id))
    throw new Error(`Agent is already in Sendero: ${agent.slug}`);

  const agentNodes = graph.nodes.filter((node) => node.kind === "agent");
  const ts = now();
  const record = {
    id: randomId("sendero-node"),
    senderoVersionId: graph.version.id,
    agentId: agent.id,
    kind: "agent" as const,
    label: input.label ?? agent.name,
    positionX: Math.max(0, ...agentNodes.map((node) => node.positionX)) + 220,
    positionY: agentNodes.at(-1)?.positionY ?? 160,
    createdAt: ts,
    updatedAt: ts,
  };
  const db = openRuntimeDb(input.home);
  await db.insert(senderoNodes).values(record);
  await emitEvent(db, "sendero.agent-added", "sendero-node", record.id, {
    senderoId: graph.sendero.id,
    agentId: agent.id,
  });
  return record;
}
