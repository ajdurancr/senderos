import { eq } from "drizzle-orm";
import { openRuntimeDb } from "../db/client";
import { agents, senderoEdges, senderoNodes, senderoVersions } from "../db/schema";
import { LifecycleError, requireLifecycle } from "./errors";

export type Step = { id: string; agentId: string; objective: string; policy: { requireReview?: boolean; evidenceKinds?: string[] } };
/** The supported execution contract is deliberately linear until branching is implemented. */
export async function route(versionId: string | null, home?: string, checkAvailability = true): Promise<Step[]> {
  const db = openRuntimeDb(home);
  if (!versionId) {
    throw new LifecycleError("WORKFLOW_REQUIRED", "Assign a published Sendero before activation; unscoped legacy transitions are not executable.");
  }
  const version = (await db.select().from(senderoVersions).where(eq(senderoVersions.id, versionId)))[0];
  requireLifecycle(version && version.status === "published", "INVALID_WORKFLOW", "Sendero version must be published");
  const nodes = await db.select().from(senderoNodes).where(eq(senderoNodes.senderoVersionId, versionId));
  const edges = (await db.select().from(senderoEdges).where(eq(senderoEdges.senderoVersionId, versionId))).filter(e => e.status === "active");
  const starts = nodes.filter(n => n.kind === "start");
  const ends = nodes.filter(n => n.kind === "end");
  requireLifecycle(starts.length === 1 && ends.length === 1, "INVALID_WORKFLOW", "Exactly one start and end are required");
  requireLifecycle(edges.every(e => nodes.some(n => n.id === e.sourceNodeId) && nodes.some(n => n.id === e.targetNodeId)), "INVALID_WORKFLOW", "Dangling workflow connection");
  const steps: Step[] = [];
  const visited = new Set<string>();
  let node = starts[0]!;
  for (;;) {
    requireLifecycle(!visited.has(node.id), "UNSUPPORTED_WORKFLOW", "Cycles are not supported");
    visited.add(node.id);
    const incoming = edges.filter(e => e.targetNodeId === node.id);
    requireLifecycle(incoming.length === (node.kind === "start" ? 0 : 1), "UNSUPPORTED_WORKFLOW", "Merges and ambiguous routes are not supported");
    const outgoing = edges.filter(e => e.sourceNodeId === node.id);
    if (node.kind === "end") {
      requireLifecycle(outgoing.length === 0, "INVALID_WORKFLOW", "End cannot have outgoing connections");
      break;
    }
    requireLifecycle(outgoing.length === 1, "UNSUPPORTED_WORKFLOW", "Every executable node must have exactly one active outgoing connection");
    const edge = outgoing[0]!;
    let condition: Record<string, unknown>;
    try { condition = JSON.parse(edge.conditionJson); } catch { throw new LifecycleError('INVALID_WORKFLOW', "Invalid workflow condition JSON"); }
    requireLifecycle(condition && !Array.isArray(condition) && typeof condition === "object" && Object.keys(condition).every(k => k === "completion"), "UNSUPPORTED_WORKFLOW", "Conditional branching is not supported");
    const policy = (condition.completion ?? {}) as Step["policy"];
    requireLifecycle(policy && typeof policy === "object" && !Array.isArray(policy) && Object.keys(policy).every(k => ["requireReview", "evidenceKinds"].includes(k)) && (policy.requireReview === undefined || typeof policy.requireReview === "boolean") && (policy.evidenceKinds === undefined || (Array.isArray(policy.evidenceKinds) && policy.evidenceKinds.every(k => ["test", "ci", "pull_request", "artifact", "manual"].includes(k)))), "INVALID_WORKFLOW", "Invalid completion policy");
    if (node.kind === "agent") {
      const agent = node.agentId && (await db.select().from(agents).where(eq(agents.id, node.agentId)))[0];
      requireLifecycle(agent && (!checkAvailability || agent.status === "active"), "AGENT_UNAVAILABLE", `Agent unavailable: ${node.label}`);
      steps.push({ id: edge.id, agentId: agent.id, objective: edge.transitionObjective, policy });
    }
    node = nodes.find(n => n.id === edge.targetNodeId)!;
  }
  requireLifecycle(visited.size === nodes.length && steps.length > 0, "INVALID_WORKFLOW", "All nodes must be on a nonempty start-to-end route");
  return steps;
}
