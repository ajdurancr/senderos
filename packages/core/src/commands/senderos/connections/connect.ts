import { openRuntimeDb } from "../../../db/client";
import { senderoEdges } from "../../../db/schema";
import { emitEvent } from "../../../shared/events";
import { now, randomId } from "../../../shared/ids";
import { getSenderoGraph } from "../get-graph";
import { resolveSenderoNode } from "../resolve-node";

export async function connectSenderoNodes(input: {
  senderoId: string;
  from: string;
  to: string;
  name: string;
  objective: string;
  description?: string;
  home?: string;
}) {
  const graph = await getSenderoGraph(input.senderoId, undefined, input.home);
  if (!graph) throw new Error(`Sendero not found: ${input.senderoId}`);
  const source = await resolveSenderoNode(graph, input.from, input.home);
  const target = await resolveSenderoNode(graph, input.to, input.home);
  if (source.kind === "end") throw new Error("End cannot start a connection");
  if (target.kind === "start") throw new Error("Start cannot receive a connection");
  if (source.id === target.id) throw new Error("A Sendero node cannot connect to itself");
  if (
    graph.edges.some(
      (edge) => edge.sourceNodeId === source.id && edge.targetNodeId === target.id,
    )
  )
    throw new Error(`Sendero connection already exists: ${input.from} -> ${input.to}`);

  const ts = now();
  const record = {
    id: randomId("sendero-edge"),
    senderoVersionId: graph.version.id,
    sourceNodeId: source.id,
    targetNodeId: target.id,
    name: input.name,
    description: input.description ?? "",
    transitionObjective: input.objective,
    conditionJson: "{}",
    status: "active" as const,
    createdAt: ts,
    updatedAt: ts,
  };
  const db = openRuntimeDb(input.home);
  await db.insert(senderoEdges).values(record);
  await emitEvent(db, "sendero.connected", "sendero-edge", record.id, {
    senderoId: graph.sendero.id,
    sourceNodeId: source.id,
    targetNodeId: target.id,
  });
  return record;
}
