import { desc, eq } from "drizzle-orm";
import { atomic, openRuntimeDb } from "../db/client";
import { agents, activations, attemptClaims, goalExecutions, goals, runAttempts, runs } from "../db/schema";
import { now, randomId } from "../shared/ids";
import { emitEvent } from "../shared/events";
import { LifecycleError, requireLifecycle } from "./errors";
import { executableGraph } from "./route";
import { requireGoal } from "./scope";
import { enableSuccessors, goalActivations, settleGoal, settledActivation, type Activation } from "./activations";

export const terminal = (status: string) => ["succeeded", "failed", "canceled"].includes(status);
/** Preserve the old cursor as a migration and aggregate record; activations own work. */
export async function cursor(goalId: string, home?: string) {
  const db = openRuntimeDb(home), goal = await requireGoal(goalId, home);
  const graph = await executableGraph(goal.senderoVersionId, home, false);
  let current = (await db.select().from(goalExecutions).where(eq(goalExecutions.goalId, goalId)))[0];
  if (current && current.activationsUsed > 0) return current;
  const persisted = await goalActivations(goalId, home);
  if (!current && persisted.length) {
    const last = persisted.filter(a => a.latestRunId).at(-1);
    await db.insert(goalExecutions).values({ goalId, transitionId: last?.transitionId ?? graph.steps[0]!.id, latestRunId: last?.latestRunId, attemptsUsed: last?.attemptsUsed ?? 0, maxAttempts: last?.maxAttempts ?? 3, maxActivations: Math.max(graph.version.maxActivations, persisted.length), activationsUsed: persisted.length });
    await settleGoal(goalId, graph, home);
    return (await db.select().from(goalExecutions).where(eq(goalExecutions.goalId, goalId)))[0]!;
  }
  const history = await db.select().from(runs).where(eq(runs.goalId, goalId)).orderBy(desc(runs.createdAt), desc(runs.id));
  requireLifecycle(history.filter(r => !terminal(r.status)).length <= 1, "INCONSISTENT_HISTORY", "Multiple legacy active runs exist; reconcile them before continuing");
  const latest = history[0], previous = latest ? (await db.select().from(runAttempts).where(eq(runAttempts.runId, latest.id)).orderBy(desc(runAttempts.attemptNumber)))[0] : undefined;
  let transitionId = current?.transitionId ?? graph.steps[0]!.id, attemptsUsed = current?.attemptsUsed ?? 0;
  if (!current && latest) {
    requireLifecycle(previous?.transitionId, "INCONSISTENT_HISTORY", "Latest run has no transition attempt");
    const index = graph.steps.findIndex(s => s.id === previous.transitionId);
    requireLifecycle(index >= 0, "INCONSISTENT_HISTORY", "Previous transition is missing from the pinned route");
    requireLifecycle(graph.nodes.every(n => graph.edges.filter(e => e.sourceNodeId === n.id).length <= 1), "INCONSISTENT_HISTORY", "Legacy graph history needs explicit reconciliation");
    transitionId = latest.status === "succeeded" ? graph.steps[index + 1]?.id ?? "" : previous.transitionId;
    if (latest.status !== "succeeded") { const ids = new Set(history.map(r => r.id)); attemptsUsed = (await db.select().from(runAttempts)).filter(a => ids.has(a.runId) && a.transitionId === transitionId).length; }
  }
  if (!current) {
    await db.insert(goalExecutions).values({ goalId, transitionId: transitionId || null, latestRunId: latest?.id ?? null, attemptsUsed, maxAttempts: latest?.maxAttempts ?? 3, maxActivations: graph.version.maxActivations });
    current = (await db.select().from(goalExecutions).where(eq(goalExecutions.goalId, goalId)))[0]!;
  }
  if (!history.length) {
    await enableSuccessors({ goalId, graph, sourceNodeId: graph.startNodeId }, home);
    await settleGoal(goalId, graph, home);
  } else if (transitionId) {
    const step = graph.steps.find(s => s.id === transitionId)!;
    const replayRun = latest && latest.status !== "succeeded" ? latest : undefined;
    const id = randomId("activation");
    await db.insert(activations).values({ id, goalId, nodeId: step.nodeId, transitionId: step.id, latestRunId: replayRun?.id ?? null, previousRunId: latest?.id ?? null, status: replayRun ? terminal(replayRun.status) ? "failed" : "running" : "ready", attemptsUsed, maxAttempts: current.maxAttempts, createdAt: now(), updatedAt: now() });
    if (replayRun) await db.update(runs).set({ activationId: id }).where(eq(runs.id, replayRun.id));
    await db.update(goalExecutions).set({ activationsUsed: 1 }).where(eq(goalExecutions.goalId, goalId));
  } else {
    await db.update(goals).set({ status: "completed", updatedAt: now() }).where(eq(goals.id, goalId));
    await db.update(goalExecutions).set({ finishedAt: now(), activationsUsed: 1 }).where(eq(goalExecutions.goalId, goalId));
  }
  return (await db.select().from(goalExecutions).where(eq(goalExecutions.goalId, goalId)))[0]!;
}
export type ActivationDecision = { goalId: string; activationId?: string; nodeId?: string; state: "ready" | "running" | "blocked" | "completed" | "canceled" | "draft"; reason: string; nextAction: string; transitionId?: string; agentId?: string; previousRunId?: string | null; revision?: number; attemptId?: string; scopes?: string[] };
async function explainActivation(a: Activation, home?: string): Promise<ActivationDecision> {
  const db = openRuntimeDb(home), goal = await requireGoal(a.goalId, home);
  const base = { goalId: a.goalId, activationId: a.id, nodeId: a.nodeId, revision: a.revision, scopes: JSON.parse(a.scopesJson) as string[] };
  if (settledActivation(a.status)) return { ...base, state: a.status === "canceled" ? "canceled" : "completed", reason: a.status, nextAction: "none" };
  if (a.status === "waiting_join" || a.status === "blocked") return { ...base, state: "blocked", reason: a.reason ?? a.status, nextAction: a.reason === "activation_limit_reached" ? "increase_activation_budget" : "wait_for_branches" };
  const attempt = a.latestRunId ? (await db.select().from(runAttempts).where(eq(runAttempts.runId, a.latestRunId)).orderBy(desc(runAttempts.attemptNumber)))[0] : undefined;
  requireLifecycle(a.status !== "running" || attempt, "INCONSISTENT_HISTORY", "Active activation has no attempt");
  if (attempt && !terminal(attempt.status)) {
    const claim = (await db.select().from(attemptClaims).where(eq(attemptClaims.attemptId, attempt.id)))[0], snapshot = JSON.parse(attempt.statusSnapshotJson);
    const stale = !snapshot.completionRequested && (claim?.ownerId ? !claim.leaseExpiresAt || Date.parse(claim.leaseExpiresAt) <= Date.now() : !claim && (!attempt.heartbeatAt || Date.now() - Date.parse(attempt.heartbeatAt) > 120000));
    return { ...base, state: stale || attempt.status === "paused" || !!claim?.cancellationRequestedAt ? "blocked" : "running", reason: claim?.cancellationRequestedAt ? "cancellation_requested" : stale ? "lease_expired" : attempt.status === "paused" ? "waiting_for_review_or_resume" : claim && !claim.ownerId ? "awaiting_host" : !attempt.startedAt ? "host_claimed" : "host_running", nextAction: claim?.cancellationRequestedAt ? "acknowledge_cancel" : stale ? "reconcile" : snapshot.completionRequested ? "review_or_record_evidence" : claim && !claim.ownerId ? "claim" : !attempt.startedAt ? "start" : "wait", attemptId: attempt.id };
  }
  const state = (await db.select().from(goalExecutions).where(eq(goalExecutions.goalId, goal.id)))[0]!;
  if (state.cancellationRequestedAt) return { ...base, state: "blocked", reason: "cancellation_requested", nextAction: "acknowledge_cancel" };
  const step = (await executableGraph(goal.senderoVersionId, home, false)).steps.find(s => s.nodeId === a.nodeId)!;
  const agent = (await db.select().from(agents).where(eq(agents.id, step.agentId)))[0];
  if (agent?.status !== "active") return { ...base, state: "blocked", reason: "AGENT_UNAVAILABLE", nextAction: "Enable the activation agent or cancel the goal" };
  if (a.attemptsUsed >= a.maxAttempts) return { ...base, state: "blocked", reason: "retry_limit_reached", nextAction: "increase_retry_budget" };
  return { ...base, state: "ready", reason: a.status === "failed" ? "retry_available" : "next_step", nextAction: "dispatch", transitionId: a.transitionId, agentId: step.agentId, previousRunId: a.latestRunId ?? a.previousRunId };
}
export async function explainGoal(goalId: string, home?: string): Promise<ActivationDecision & { activations: ActivationDecision[] }> {
  return atomic(home, async () => {
    const goal = await requireGoal(goalId, home);
    if (["draft", "completed", "canceled"].includes(goal.status)) return { goalId, state: goal.status as "draft" | "completed" | "canceled", reason: goal.status, nextAction: goal.status === "draft" ? "activate" : "none", activations: [] };
    try {
      await cursor(goalId, home);
      const decisions = await Promise.all((await goalActivations(goalId, home)).map(a => explainActivation(a, home)));
      const primary = decisions.find(d => d.state === "ready") ?? decisions.find(d => d.state === "running") ?? decisions.find(d => d.state === "blocked");
      return primary ? { ...primary, activations: decisions } : { goalId, state: "completed", reason: "end_reached", nextAction: "none", activations: decisions };
    } catch (error) { if (!(error instanceof LifecycleError)) throw error; return { goalId, state: "blocked", reason: error.code, nextAction: error.message, activations: [] }; }
  });
}
export async function setRetryBudget(goalId: string, maxAttempts: number, home?: string) {
  return atomic(home, async () => {
    const goal = await requireGoal(goalId, home);
    requireLifecycle(!["completed", "canceled"].includes(goal.status), "TERMINAL_GOAL", "Cannot change a terminal goal");
    requireLifecycle(goal.status !== "draft", "GOAL_NOT_ACTIVE", "Activate the goal before changing its execution budget");
    requireLifecycle(Number.isInteger(maxAttempts) && maxAttempts >= 1 && maxAttempts <= 100, "INVALID_INPUT", "Retry budget must be an integer from 1 to 100");
    const state = await cursor(goalId, home);
    requireLifecycle(!state.cancellationRequestedAt, "CANCELLATION_REQUESTED", "Cannot change execution budgets while cancellation is pending");
    const db = openRuntimeDb(home);
    await db.update(goalExecutions).set({ maxAttempts }).where(eq(goalExecutions.goalId, goalId));
    for (const a of await goalActivations(goalId, home)) if (!settledActivation(a.status)) await db.update(activations).set({ maxAttempts, revision: a.revision + 1 }).where(eq(activations.id, a.id));
    await emitEvent(db, "goal.retry-budget-updated", "goal", goalId, { maxAttempts });
    return explainGoal(goalId, home);
  });
}
export async function setActivationBudget(goalId: string, maxActivations: number, home?: string) {
  return atomic(home, async () => {
    const goal = await requireGoal(goalId, home);
    requireLifecycle(!["completed", "canceled"].includes(goal.status), "TERMINAL_GOAL", "Cannot change a terminal goal");
    requireLifecycle(goal.status !== "draft", "GOAL_NOT_ACTIVE", "Activate the goal before changing its execution budget");
    const state = await cursor(goalId, home);
    requireLifecycle(!state.cancellationRequestedAt, "CANCELLATION_REQUESTED", "Cannot change execution budgets while cancellation is pending");
    requireLifecycle(Number.isInteger(maxActivations) && maxActivations >= state.activationsUsed && maxActivations >= 1 && maxActivations <= 10000, "INVALID_INPUT", "Activation budget must cover used activations and be at most 10000");
    await openRuntimeDb(home).update(goalExecutions).set({ maxActivations }).where(eq(goalExecutions.goalId, goalId));
    const graph = await executableGraph(goal.senderoVersionId, home, false);
    for (const a of await goalActivations(goalId, home)) if (a.status === "blocked" && a.reason === "activation_limit_reached") { const pending = JSON.parse(a.inputJson).pendingRouting; await enableSuccessors({ goalId, graph, sourceNodeId: a.nodeId, parent: a, result: pending.result, snapshot: pending.snapshot }, home); }
    await settleGoal(goalId, graph, home);
    await emitEvent(openRuntimeDb(home), "goal.activation-budget-updated", "goal", goalId, { maxActivations });
    return explainGoal(goalId, home);
  });
}
