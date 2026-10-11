import { eq } from "drizzle-orm";
import { openRuntimeDb } from "../db/client";
import { agents, senderoEdges, senderoNodes, senderoVersions } from "../db/schema";
import { LifecycleError, requireLifecycle } from "./errors";

export type CompletionPolicy = { requireReview?: boolean; evidenceKinds?: string[] };
export type Step = { id: string; nodeId: string; agentId: string; objective: string; policy: CompletionPolicy; requirements: string[]; agent: { id: string; name: string; instructions: string }; joinForkNodeId: string | null };
export type EdgeCondition = { outcome?: string; completion?: CompletionPolicy };
export function parseCondition(value: string): EdgeCondition {
  let condition: unknown;
  try { condition = JSON.parse(value); } catch { throw new LifecycleError("INVALID_WORKFLOW", "Invalid workflow condition JSON"); }
  requireLifecycle(condition && typeof condition === "object" && !Array.isArray(condition), "INVALID_WORKFLOW", "Workflow condition must be an object");
  const c = condition as Record<string, unknown>;
  requireLifecycle(Object.keys(c).every(k => ["outcome", "completion"].includes(k)), "UNSUPPORTED_WORKFLOW", "Conditions support an exact outcome string and optional legacy completion policy");
  requireLifecycle(c.outcome === undefined || typeof c.outcome === "string" && c.outcome.trim().length > 0, "INVALID_WORKFLOW", "Outcome condition must be a nonempty string");
  completionPolicy(c.completion ?? {});
  return c as EdgeCondition;
}
export function completionPolicy(value: unknown): CompletionPolicy {
  requireLifecycle(value && typeof value === "object" && !Array.isArray(value), "INVALID_WORKFLOW", "Invalid completion policy");
  const p = value as Record<string, unknown>;
  requireLifecycle(Object.keys(p).every(k => ["requireReview", "evidenceKinds"].includes(k)) && (p.requireReview === undefined || typeof p.requireReview === "boolean") && (p.evidenceKinds === undefined || Array.isArray(p.evidenceKinds) && p.evidenceKinds.every(k => ["test", "ci", "pull_request", "artifact", "manual"].includes(k))), "INVALID_WORKFLOW", "Invalid completion policy");
  return p as CompletionPolicy;
}
export async function executableGraph(versionId: string | null, home?: string, checkAvailability = true) {
  const db = openRuntimeDb(home);
  requireLifecycle(versionId, "WORKFLOW_REQUIRED", "Assign a published Sendero before activation; unscoped legacy transitions are not executable.");
  const version = (await db.select().from(senderoVersions).where(eq(senderoVersions.id, versionId)))[0];
  requireLifecycle(version?.status === "published", "INVALID_WORKFLOW", "Sendero version must be published");
  requireLifecycle(Number.isInteger(version.maxActivations) && version.maxActivations >= 1 && version.maxActivations <= 10000, "INVALID_WORKFLOW", "Activation budget must be an integer from 1 to 10000");
  const nodes = await db.select().from(senderoNodes).where(eq(senderoNodes.senderoVersionId, versionId));
  const edges = (await db.select().from(senderoEdges).where(eq(senderoEdges.senderoVersionId, versionId))).filter(e => e.status === "active");
  const starts = nodes.filter(n => n.kind === "start"), ends = nodes.filter(n => n.kind === "end");
  requireLifecycle(starts.length === 1 && ends.length >= 1, "INVALID_WORKFLOW", "Exactly one start and at least one end are required");
  requireLifecycle(nodes.every(n => ["start", "agent", "end"].includes(n.kind)), "INVALID_WORKFLOW", "Unknown workflow node kind");
  requireLifecycle(edges.every(e => nodes.some(n => n.id === e.sourceNodeId) && nodes.some(n => n.id === e.targetNodeId)), "INVALID_WORKFLOW", "Dangling workflow connection");
  requireLifecycle(new Set(edges.map(e => JSON.stringify([e.sourceNodeId, e.targetNodeId, parseCondition(e.conditionJson).outcome ?? null]))).size === edges.length, "UNSUPPORTED_WORKFLOW", "Duplicate routing edges are ambiguous; use one edge per source, target, and outcome");
  const conditions = new Map(edges.map(e => [e.id, parseCondition(e.conditionJson)]));
  requireLifecycle(!edges.some(e => e.targetNodeId === starts[0]!.id), "INVALID_WORKFLOW", "Start cannot have incoming connections");
  requireLifecycle(!edges.some(e => ends.some(n => n.id === e.sourceNodeId)), "INVALID_WORKFLOW", "End cannot have outgoing connections");
  requireLifecycle(edges.filter(e => e.sourceNodeId === starts[0]!.id).every(e => !conditions.get(e.id)!.outcome), "INVALID_WORKFLOW", "Start edges must be unconditional");
  const reachable = (from: string[], reverse = false, excluded?: string) => {
    const seen = new Set<string>(), todo = [...from];
    while (todo.length) { const id = todo.shift()!; if (id === excluded || seen.has(id)) continue; seen.add(id); for (const e of edges) if ((reverse ? e.targetNodeId : e.sourceNodeId) === id) todo.push(reverse ? e.sourceNodeId : e.targetNodeId); }
    return seen;
  };
  const order = reachable([starts[0]!.id]), toEnd = reachable(ends.map(n => n.id), true);
  requireLifecycle(order.size === nodes.length && nodes.every(n => toEnd.has(n.id)) && nodes.some(n => n.kind === "agent"), "INVALID_WORKFLOW", "All nodes must be reachable from start and able to reach an end");
  const steps: Step[] = [];
  for (const id of order) {
    const node = nodes.find(n => n.id === id)!;
    if (node.kind !== "agent") continue;
    const outgoing = edges.filter(e => e.sourceNodeId === id);
    requireLifecycle(outgoing.length > 0, "INVALID_WORKFLOW", `Agent has no exit: ${node.label}`);
    const live = node.agentId && (await db.select().from(agents).where(eq(agents.id, node.agentId)))[0];
    requireLifecycle(live && (!checkAvailability || live.status === "active"), "AGENT_UNAVAILABLE", `Agent unavailable: ${node.label}`);
    let pinned: { id: string; name: string; instructions: string; requiredCapabilities?: string[] };
    try { pinned = node.agentSnapshotJson ? JSON.parse(node.agentSnapshotJson) : { id: live.id, name: live.name, instructions: live.definitionBody, requiredCapabilities: JSON.parse(live.defaultMetaJson).requiredCapabilities }; } catch { throw new LifecycleError("INVALID_WORKFLOW", "Invalid agent snapshot"); }
    const first = outgoing[0]!;
    if (node.executionObjective === null) requireLifecycle(outgoing.every(e => e.transitionObjective === first.transitionObjective && JSON.stringify(conditions.get(e.id)!.completion ?? {}) === JSON.stringify(conditions.get(first.id)!.completion ?? {})), "INVALID_WORKFLOW", "Branching legacy nodes need an explicit node objective and completion policy");
    let policy: CompletionPolicy, required: unknown;
    try { policy = completionPolicy(node.executionObjective === null ? conditions.get(first.id)!.completion ?? {} : JSON.parse(node.completionJson)); required = JSON.parse(node.requirementsJson); } catch (e) { if (e instanceof LifecycleError) throw e; throw new LifecycleError("INVALID_WORKFLOW", "Invalid node policy JSON"); }
    requireLifecycle(Array.isArray(required) && required.every(x => typeof x === "string" && /^[a-zA-Z0-9][a-zA-Z0-9_.:-]*$/.test(x)), "INVALID_WORKFLOW", "Node requirements must be nonempty capability names");
    requireLifecycle(pinned.requiredCapabilities === undefined || Array.isArray(pinned.requiredCapabilities) && pinned.requiredCapabilities.every(x => typeof x === "string" && /^[a-zA-Z0-9][a-zA-Z0-9_.:-]*$/.test(x)), "INVALID_WORKFLOW", "Agent requiredCapabilities must be capability names");
    if (node.joinForkNodeId) {
      const fork = nodes.find(n => n.id === node.joinForkNodeId);
      requireLifecycle(fork && fork.id !== id && fork.kind !== "end" && edges.filter(e => e.sourceNodeId === fork.id).length > 1, "INVALID_JOIN", "A join must name a distinct fork with multiple outgoing edges");
      requireLifecycle(!reachable([starts[0]!.id], false, fork.id).has(id), "INVALID_JOIN", "The paired fork must dominate its join; every entry path must pass through the fork");
      requireLifecycle(!reachable(outgoing.map(e => e.targetNodeId), false, fork.id).has(id), "INVALID_JOIN", "A consumed join can only be revisited through a new visit to its paired fork");
      requireLifecycle(!nodes.some(n => n.id !== id && n.joinForkNodeId === fork.id), "INVALID_JOIN", "One explicit join is supported per fork node");
    }
    steps.push({ id: first.id, nodeId: id, agentId: live.id, objective: node.executionObjective ?? first.transitionObjective, policy, requirements: [...new Set([...(required as string[]), ...(pinned.requiredCapabilities ?? [])])], agent: { id: pinned.id, name: pinned.name, instructions: pinned.instructions }, joinForkNodeId: node.joinForkNodeId });
  }
  const joins = steps.filter(step => step.joinForkNodeId);
  for (const outer of joins) for (const inner of joins) {
    if (outer.nodeId === inner.nodeId) continue;
    const outerFork = outer.joinForkNodeId!, innerFork = inner.joinForkNodeId!;
    const nested = reachable([outerFork], false, outer.nodeId).has(innerFork) && !reachable([starts[0]!.id], false, outerFork).has(innerFork);
    requireLifecycle(!nested || !reachable([innerFork], false, inner.nodeId).has(outer.nodeId), "INVALID_JOIN", "Paired joins must be nested: paths from an inner fork to an outer join must consume the inner join first");
  }
  return { version, nodes, edges, steps, startNodeId: starts[0]!.id };
}
/** Stable execution steps, one per agent node. Graph progression uses activations. */
export async function route(versionId: string | null, home?: string, checkAvailability = true): Promise<Step[]> {
  return (await executableGraph(versionId, home, checkAvailability)).steps;
}
