import { desc, eq } from "drizzle-orm";
import { atomic, openRuntimeDb } from "../db/client";
import { attemptClaims, goalExecutions, goals, runAttempts, runs } from "../db/schema";
import { now } from "../shared/ids";
import { emitEvent } from "../shared/events";
import { LifecycleError, requireLifecycle } from "./errors";
import { route } from "./route";
import { requireGoal } from "./scope";

export const terminal = (status: string) => ["succeeded", "failed", "canceled"].includes(status);
export async function cursor(goalId: string, home?: string) {
  const db = openRuntimeDb(home);
  const current = (await db.select().from(goalExecutions).where(eq(goalExecutions.goalId, goalId)))[0];
  if (current) return current;
  // Reconcile pre-upgrade history once. Ambiguous active history must be repaired explicitly.
  const history = await db.select().from(runs).where(eq(runs.goalId, goalId)).orderBy(desc(runs.createdAt), desc(runs.id));
  requireLifecycle(history.filter(r => !terminal(r.status)).length <= 1, "INCONSISTENT_HISTORY", "Multiple active runs exist; reconcile them before continuing");
  const latest = history[0];
  const attempts = latest ? await db.select().from(runAttempts).where(eq(runAttempts.runId, latest.id)).orderBy(desc(runAttempts.attemptNumber)) : [];
  const previous = attempts[0];
  const goal = await requireGoal(goalId, home);
  const steps = await route(goal.senderoVersionId, home);
  let transitionId = steps[0]!.id;
  let attemptsUsed = 0;
  if (latest) {
    requireLifecycle(previous?.transitionId, "INCONSISTENT_HISTORY", "Latest run has no transition attempt");
    const index = steps.findIndex(s => s.id === previous.transitionId);
    requireLifecycle(index >= 0, "INCONSISTENT_HISTORY", "Previous transition is missing from the pinned route");
    transitionId = latest.status === "succeeded" ? steps[index + 1]?.id ?? "" : previous.transitionId;
    if (latest.status !== "succeeded") {
      const allAttempts = await db.select().from(runAttempts);
      const runIds = new Set(history.map(r => r.id));
      attemptsUsed = allAttempts.filter(a => runIds.has(a.runId) && a.transitionId === transitionId).length;
    }
  }
  const record = { goalId, transitionId: transitionId || null, latestRunId: latest?.id ?? null, attemptsUsed, maxAttempts: latest?.maxAttempts ?? 3, revision: 0, finishedAt: null };
  await db.insert(goalExecutions).values(record).onConflictDoNothing();
  return (await db.select().from(goalExecutions).where(eq(goalExecutions.goalId, goalId)))[0]!;
}

export async function explainGoal(goalId: string, home?: string): Promise<{
  goalId: string; state: "ready" | "running" | "blocked" | "completed" | "canceled" | "draft";
  reason: string; nextAction: string; transitionId?: string; agentId?: string;
  previousRunId?: string | null; revision?: number; attemptId?: string;
}> {
  return atomic(home, async () => {
    const goal = await requireGoal(goalId, home);
    if (["draft", "completed", "canceled"].includes(goal.status)) return {
      goalId, state: goal.status as "draft" | "completed" | "canceled", reason: goal.status,
      nextAction: goal.status === "draft" ? "activate" : "none",
    };
    try {
      const db = openRuntimeDb(home);
      const state = await cursor(goalId, home);
      const previous = state.latestRunId ? (await db.select().from(runs).where(eq(runs.id, state.latestRunId)))[0] : undefined;
      if (previous && !terminal(previous.status)) {
        const attempt = (await db.select().from(runAttempts).where(eq(runAttempts.runId, previous.id)).orderBy(desc(runAttempts.attemptNumber)))[0];
        requireLifecycle(attempt, "INCONSISTENT_HISTORY", "Active run has no attempt");
        const claim = (await db.select().from(attemptClaims).where(eq(attemptClaims.attemptId, attempt.id)))[0];
        const snapshot = JSON.parse(attempt.statusSnapshotJson);
        const stale = !snapshot.completionRequested && (claim?.ownerId ? !claim.leaseExpiresAt || Date.parse(claim.leaseExpiresAt) <= Date.now()
          : !claim && (!attempt.heartbeatAt || Date.now() - Date.parse(attempt.heartbeatAt) > 120_000));
        return { goalId, state: stale || attempt.status === "paused" || !!claim?.cancellationRequestedAt ? "blocked" : "running",
          reason: claim?.cancellationRequestedAt ? "cancellation_requested" : stale ? "lease_expired" : attempt.status === "paused" ? "waiting_for_review_or_resume" : claim && !claim.ownerId ? "awaiting_host" : "host_running",
          nextAction: claim?.cancellationRequestedAt ? "acknowledge_cancel" : stale ? "reclaim" : snapshot.completionRequested ? "review_or_record_evidence" : claim && !claim.ownerId ? "claim" : "wait",
          attemptId: attempt.id, revision: state.revision };
      }
      const steps = await route(goal.senderoVersionId, home);
      if (!state.transitionId) {
        requireLifecycle(previous?.status === "succeeded", "INCONSISTENT_HISTORY", "Missing execution position");
        await db.update(goals).set({ status: "completed", updatedAt: now() }).where(eq(goals.id, goalId));
        await db.update(goalExecutions).set({ finishedAt: now() }).where(eq(goalExecutions.goalId, goalId));
        await emitEvent(db, "goal.completed", "goal", goalId, { reconciled: true });
        return { goalId, state: "completed", reason: "end_reached", nextAction: "none" };
      }
      const step = steps.find(s => s.id === state.transitionId);
      requireLifecycle(step, "INVALID_WORKFLOW", "Current step no longer exists");
      if (state.attemptsUsed >= state.maxAttempts) return { goalId, state: "blocked", reason: "retry_limit_reached", nextAction: "increase_retry_budget", revision: state.revision };
      return { goalId, state: "ready", reason: previous?.status === "failed" ? "retry_available" : "next_step", nextAction: "dispatch", transitionId: step.id, agentId: step.agentId, previousRunId: state.latestRunId, revision: state.revision };
    } catch (error) {
      if (!(error instanceof LifecycleError)) throw error;
      return { goalId, state: "blocked", reason: error.code, nextAction: error.message };
    }
  });
}

export async function setRetryBudget(goalId: string, maxAttempts: number, home?: string) {
  return atomic(home, async () => {
    const goal = await requireGoal(goalId, home);
    requireLifecycle(!["completed", "canceled"].includes(goal.status), "TERMINAL_GOAL", "Cannot change a terminal goal");
    requireLifecycle(Number.isInteger(maxAttempts) && maxAttempts >= 1 && maxAttempts <= 100, "INVALID_INPUT", "Retry budget must be an integer from 1 to 100");
    await cursor(goalId, home);
    await openRuntimeDb(home).update(goalExecutions).set({ maxAttempts }).where(eq(goalExecutions.goalId, goalId));
    await emitEvent(openRuntimeDb(home), "goal.retry-budget-updated", "goal", goalId, { maxAttempts });
    return explainGoal(goalId, home);
  });
}
