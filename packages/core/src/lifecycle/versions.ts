import { and, desc, eq } from "drizzle-orm";
import { atomic, openRuntimeDb } from "../db/client";
import { agents, senderos, senderoVersions, senderoNodes, senderoEdges } from "../db/schema";
import { getSenderoGraph } from "../commands/senderos/get-graph";
import { now, randomId } from "../shared/ids";
import { requireLifecycle } from "./errors";
import { route } from "./route";
import { emitEvent } from "../shared/events";
import { resolveSenderoAgentNode } from '../internal/senderos/resolve-node';
import { updateSenderoEdge } from '../internal/senderos/update-edge';

export async function draftSendero(senderoId: string, home?: string) {
  return atomic(home, async () => {
    const graph = await getSenderoGraph(senderoId, undefined, home);
    requireLifecycle(graph, "NOT_FOUND", "Sendero not found");
    const db = openRuntimeDb(home);
    const versions = await db.select().from(senderoVersions).where(eq(senderoVersions.senderoId, graph.sendero.id)).orderBy(desc(senderoVersions.version));
    const existing = versions.find(v => v.status === "draft");
    if (existing) return getSenderoGraph(graph.sendero.id, existing.version, home);
    const version = { id: randomId("sendero-version"), senderoId: graph.sendero.id, version: versions[0]!.version + 1, status: "draft", maxActivations: graph.version.maxActivations, protocolVersion: 2, createdAt: now() };
    const ids = new Map(graph.nodes.map(n => [n.id, randomId("sendero-node")]));
    await db.insert(senderoVersions).values(version);
    await db.insert(senderoNodes).values(graph.nodes.map(n => ({ ...n, id: ids.get(n.id)!, senderoVersionId: version.id, agentSnapshotJson: null, joinForkNodeId: n.joinForkNodeId ? ids.get(n.joinForkNodeId)! : null })));
    await db.insert(senderoEdges).values(graph.edges.map(e => ({ ...e, id: randomId("sendero-edge"), senderoVersionId: version.id, sourceNodeId: ids.get(e.sourceNodeId)!, targetNodeId: ids.get(e.targetNodeId)! })));
    await emitEvent(db, "sendero.draft-created", "sendero", graph.sendero.id, { version: version.version });
    return getSenderoGraph(graph.sendero.id, version.version, home);
  });
}
export async function editableGraph(senderoId: string, home?: string) {
  const graph = await getSenderoGraph(senderoId, undefined, home);
  requireLifecycle(graph, "NOT_FOUND", "Sendero not found");
  const draft = (await openRuntimeDb(home).select().from(senderoVersions).where(and(eq(senderoVersions.senderoId, graph.sendero.id), eq(senderoVersions.status, "draft"))))[0];
  requireLifecycle(draft, "IMMUTABLE_VERSION", "Create a Sendero draft before editing its definition");
  return (await getSenderoGraph(graph.sendero.id, draft.version, home))!;
}
export async function requireDraft(versionId: string, home?: string, expectedRevision?: string) {
  const version = (await openRuntimeDb(home).select().from(senderoVersions).where(eq(senderoVersions.id, versionId)))[0];
  requireLifecycle(version?.status === "draft", "IMMUTABLE_VERSION", "Published definitions are immutable; edit a new draft");
  if (expectedRevision !== undefined) {
    const graph = await getSenderoGraph(version.senderoId, version.version, home);
    requireLifecycle(graph?.revision === expectedRevision, "STALE_DRAFT", "The Sendero definition or its agents changed; reload it before editing");
  }
}
export async function publishSendero(senderoId: string, home?: string, expectedVersionId?: string, expectedRevision?: string) {
  return atomic(home, async () => {
    const graph = await editableGraph(senderoId, home);
    requireLifecycle(expectedVersionId === undefined || graph.version.id === expectedVersionId, "STALE_VERSION", "The Sendero draft changed; reload it before publishing");
    requireLifecycle(expectedRevision === undefined || graph.revision === expectedRevision, "STALE_DRAFT", "The Sendero definition or its agents changed; review it again before publishing");
    const db = openRuntimeDb(home);
    for (const node of graph.nodes.filter(n => n.kind === "agent")) {
      const agent = (await db.select().from(agents).where(eq(agents.id, node.agentId!)))[0];
      requireLifecycle(agent, "AGENT_UNAVAILABLE", "Agent unavailable");
      await db.update(senderoNodes).set({ agentSnapshotJson: JSON.stringify({ id: agent.id, name: agent.name, instructions: agent.definitionBody, requiredCapabilities: JSON.parse(agent.defaultMetaJson).requiredCapabilities ?? [] }) }).where(eq(senderoNodes.id, node.id));
    }
    await db.update(senderoVersions).set({ status: "published", protocolVersion: 2 }).where(eq(senderoVersions.id, graph.version.id));
    await route(graph.version.id, home); // Failure rolls the publication back.
    await db.update(senderos).set({ status: "active", currentVersion: graph.version.version, updatedAt: now() }).where(eq(senderos.id, graph.sendero.id));
    await emitEvent(db, "sendero.published", "sendero", graph.sendero.id, { version: graph.version.version });
    return getSenderoGraph(graph.sendero.id, graph.version.version, home);
  });
}

export async function setCompletionPolicy(input: { senderoId: string; agent: string; requireReview: boolean; evidenceKinds: string[] }, home?: string) {
  return atomic(home, async () => {
    const graph = await editableGraph(input.senderoId, home);
    const node = await resolveSenderoAgentNode(graph, input.agent, home);
    const edge = graph.edges.find(e => e.sourceNodeId === node.id);
    requireLifecycle(edge, 'INVALID_WORKFLOW', 'Agent must have an outgoing connection');
    await openRuntimeDb(home).update(senderoNodes).set({ executionObjective: node.executionObjective ?? edge.transitionObjective, completionJson: JSON.stringify({ requireReview: input.requireReview, evidenceKinds: input.evidenceKinds }) }).where(eq(senderoNodes.id, node.id));
    return updateSenderoEdge({ home, id: edge.id, completion: { requireReview: input.requireReview, evidenceKinds: input.evidenceKinds } });
  });
}
