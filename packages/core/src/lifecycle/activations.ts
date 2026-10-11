import { and, eq } from "drizzle-orm";
import { openRuntimeDb } from "../db/client";
import { activations, forkGenerations, goalExecutions, goals, runs } from "../db/schema";
import { now, randomId } from "../shared/ids";
import { emitEvent } from "../shared/events";
import { executableGraph, parseCondition } from "./route";
import { requireLifecycle } from "./errors";

export type Activation = typeof activations.$inferSelect;
type Graph = Awaited<ReturnType<typeof executableGraph>>;
export const settledActivation = (status: string) => ["succeeded", "joined", "canceled"].includes(status);
export async function goalActivations(goalId: string, home?: string) {
  return openRuntimeDb(home).select().from(activations).where(eq(activations.goalId, goalId));
}
/** Called only inside the caller's write transaction. No process is launched here. */
export async function enableSuccessors(input: { goalId: string; graph: Graph; sourceNodeId: string; parent?: Activation; result?: Record<string, unknown>; snapshot?: Record<string, unknown>; scopes?: string[] }, home?: string) {
  const { graph, parent, goalId } = input;
  const selected = graph.edges.filter(e => e.sourceNodeId === input.sourceNodeId && (!parseCondition(e.conditionJson).outcome || parseCondition(e.conditionJson).outcome === input.result?.outcome));
  requireLifecycle(selected.length > 0, "NO_MATCHING_EDGE", "No outgoing edge matches result.outcome; report a configured outcome");
  const db = openRuntimeDb(home), ts = now();
  const state = (await db.select().from(goalExecutions).where(eq(goalExecutions.goalId, goalId)))[0]!;
  requireLifecycle(!state.cancellationRequestedAt, "CANCELLATION_REQUESTED", "Canceled work cannot enable successors");
  const targets = selected.map(e => graph.nodes.find(n => n.id === e.targetNodeId)!);
  if (state.activationsUsed + targets.filter(n => n.kind === "agent").length > state.maxActivations) {
    requireLifecycle(parent, "ACTIVATION_LIMIT", "Activation budget cannot fit the initial fanout");
    await db.update(activations).set({ status: "blocked", reason: "activation_limit_reached", inputJson: JSON.stringify({ ...JSON.parse(parent.inputJson), pendingRouting: { result: input.result, snapshot: input.snapshot } }), revision: parent.revision + 1, updatedAt: ts }).where(eq(activations.id, parent.id));
    await db.update(goals).set({ status: "blocked", updatedAt: ts }).where(eq(goals.id, goalId));
    return;
  }
  const scopes = [...(input.scopes ?? (parent ? JSON.parse(parent.scopesJson) as string[] : []))];
  if (graph.edges.filter(e => e.sourceNodeId === input.sourceNodeId).length > 1) {
    const forkId = randomId("fork");
    await db.insert(forkGenerations).values({ id: forkId, goalId, forkNodeId: input.sourceNodeId, forkActivationId: parent?.id ?? null, createdAt: ts });
    scopes.push(forkId);
  }
  let count = 0;
  for (const node of targets) {
    if (node.kind === "end") continue;
    const step = graph.steps.find(s => s.nodeId === node.id)!;
    const record = { id: randomId("activation"), goalId, nodeId: node.id, transitionId: step.id,
      parentActivationId: parent?.id ?? null, previousRunId: parent?.latestRunId ?? null,
      status: step.joinForkNodeId ? "waiting_join" : "ready", reason: step.joinForkNodeId ? "waiting_for_join" : null,
      scopesJson: JSON.stringify(scopes), inputJson: JSON.stringify({ previous: parent ? { activationId: parent.id, runId: parent.latestRunId, result: input.result ?? {}, snapshot: input.snapshot ?? {} } : null }),
      maxAttempts: state.maxAttempts, createdAt: ts, updatedAt: ts };
    if (step.joinForkNodeId) {
      const generations = await db.select().from(forkGenerations).where(eq(forkGenerations.goalId, goalId));
      requireLifecycle(scopes.some(id => generations.some(g => g.id === id && g.forkNodeId === step.joinForkNodeId && g.status === "open")), "INVALID_JOIN", "Join arrival has no live paired fork generation");
    }
    await db.insert(activations).values(record); count++;
    await emitEvent(db, "activation.enabled", "goal", goalId, { activationId: record.id, nodeId: node.id, parentActivationId: record.parentActivationId, scopes });
  }
  await db.update(goalExecutions).set({ activationsUsed: state.activationsUsed + count, revision: state.revision + 1 }).where(eq(goalExecutions.goalId, goalId));
  if (parent) await db.update(activations).set({ status: "succeeded", reason: null, revision: parent.revision + 1, updatedAt: ts }).where(eq(activations.id, parent.id));
}
/** Joins consume arrivals exactly once after all selected descendants settle. */
export async function reconcileJoins(goalId: string, graph: Graph, home?: string) {
  const db = openRuntimeDb(home);
  for (const generation of await db.select().from(forkGenerations).where(and(eq(forkGenerations.goalId, goalId), eq(forkGenerations.status, "open")))) {
    const join = graph.steps.find(s => s.joinForkNodeId === generation.forkNodeId);
    if (!join) continue;
    const members = (await goalActivations(goalId, home)).filter(a => (JSON.parse(a.scopesJson) as string[]).includes(generation.id));
    const arrivals = members.filter(a => a.status === "waiting_join" && a.nodeId === join.nodeId);
    // Inner reentries of the same fork must settle their own latest generation first.
    const allGenerations = await db.select().from(forkGenerations).where(eq(forkGenerations.goalId, goalId));
    const ownArrivals = arrivals.filter(a => [...JSON.parse(a.scopesJson) as string[]].reverse().find(id => allGenerations.some(g => g.id === id && g.forkNodeId === join.joinForkNodeId)) === generation.id);
    if (members.some(a => !settledActivation(a.status) && !ownArrivals.some(v => v.id === a.id))) continue;
    await db.update(forkGenerations).set({ status: "closed" }).where(eq(forkGenerations.id, generation.id));
    if (!ownArrivals.length) continue;
    const first = ownArrivals[0]!;
    const scopes = JSON.parse(first.scopesJson) as string[];
    const joined = ownArrivals.map(a => ({ activationId: a.id, ...JSON.parse(a.inputJson) }));
    await db.update(activations).set({ status: "ready", reason: null, scopesJson: JSON.stringify(scopes.slice(0, scopes.indexOf(generation.id))), inputJson: JSON.stringify({ forkGenerationId: generation.id, arrivals: joined }), revision: first.revision + 1, updatedAt: now() }).where(eq(activations.id, first.id));
    for (const duplicate of ownArrivals.slice(1)) await db.update(activations).set({ status: "joined", reason: `joined_into:${first.id}`, updatedAt: now() }).where(eq(activations.id, duplicate.id));
    await emitEvent(db, "activation.join-ready", "goal", goalId, { activationId: first.id, forkGenerationId: generation.id, arrivals: ownArrivals.map(a => a.id) });
  }
}
export async function settleGoal(goalId: string, graph: Graph, home?: string) {
  await reconcileJoins(goalId, graph, home);
  const db = openRuntimeDb(home), state = (await db.select().from(goalExecutions).where(eq(goalExecutions.goalId, goalId)))[0]!;
  const all = await goalActivations(goalId, home);
  const pending = all.filter(a => !settledActivation(a.status));
  const status = state.cancellationRequestedAt ? (pending.length ? "blocked" : "canceled") : !pending.length ? "completed" : pending.every(a => a.status === "failed") ? "failed" : pending.every(a => ["failed", "blocked", "waiting_join"].includes(a.status)) ? "blocked" : "active";
  const goal = (await db.select().from(goals).where(eq(goals.id, goalId)))[0]!;
  await db.update(goals).set({ status, updatedAt: now() }).where(eq(goals.id, goalId));
  if (["completed", "canceled"].includes(status)) {
    await db.update(goalExecutions).set({ finishedAt: now(), transitionId: null }).where(eq(goalExecutions.goalId, goalId));
    if (goal.status !== status) await emitEvent(db, `goal.${status}`, "goal", goalId, {});
  }
}
export async function activationForRun(runId: string, home?: string) {
  const db = openRuntimeDb(home);
  const run = (await db.select().from(runs).where(eq(runs.id, runId)))[0];
  return run?.activationId ? (await db.select().from(activations).where(eq(activations.id, run.activationId)))[0] : undefined;
}
