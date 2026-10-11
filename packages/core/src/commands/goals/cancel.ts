import { eq } from "drizzle-orm";
import { atomic, openRuntimeDb } from "../../db/client";
import { activations, goals, runs, runAttempts, attemptClaims, goalExecutions } from "../../db/schema";
import { requireGoal } from "../../lifecycle/scope";
import { requireLifecycle } from "../../lifecycle/errors";
import { terminal } from "../../lifecycle/state";
import { now } from "../../shared/ids";
import { emitEvent } from "../../shared/events";
import { getGoal } from "./get";
export async function cancelGoal(id: string, home?: string) {
  return atomic(home, async () => {
    const goal = await requireGoal(id, home);
    requireLifecycle(goal.status !== "completed", "TERMINAL_GOAL", "Completed goals cannot be canceled");
    if (goal.status === "canceled") return getGoal(id, home);
    const db = openRuntimeDb(home); const ts = now(); let pending = false;
    await db.update(goalExecutions).set({ cancellationRequestedAt: ts }).where(eq(goalExecutions.goalId, id));
    for (const activation of await db.select().from(activations).where(eq(activations.goalId, id))) {
      if (["ready", "failed", "blocked", "waiting_join"].includes(activation.status)) await db.update(activations).set({ status: "canceled", reason: null, revision: activation.revision + 1, updatedAt: ts }).where(eq(activations.id, activation.id));
    }
    for (const run of await db.select().from(runs).where(eq(runs.goalId, id))) {
      if (terminal(run.status)) continue;
      for (const attempt of await db.select().from(runAttempts).where(eq(runAttempts.runId, run.id))) {
        if (terminal(attempt.status)) continue;
        const claim = (await db.select().from(attemptClaims).where(eq(attemptClaims.attemptId, attempt.id)))[0];
        // Once a host owns execution, only its acknowledgement proves it stopped.
        if (claim?.ownerId || attempt.status === "running") {
          pending = true;
          await db.insert(attemptClaims).values({ attemptId: attempt.id, cancellationRequestedAt: ts }).onConflictDoUpdate({ target: attemptClaims.attemptId, set: { cancellationRequestedAt: ts } });
        } else {
          await db.update(runAttempts).set({ status: "canceled", finishedAt: ts, updatedAt: ts }).where(eq(runAttempts.id, attempt.id));
          await db.update(runs).set({ status: "canceled", updatedAt: ts }).where(eq(runs.id, run.id));
          if (run.activationId) await db.update(activations).set({ status: "canceled", reason: null, updatedAt: ts }).where(eq(activations.id, run.activationId));
        }
      }
    }
    await db.update(goals).set({ status: pending ? "blocked" : "canceled", updatedAt: ts }).where(eq(goals.id, id));
    if (!pending) await db.update(goalExecutions).set({ finishedAt: ts }).where(eq(goalExecutions.goalId, id));
    await emitEvent(db, pending ? "goal.cancellation-requested" : "goal.canceled", "goal", id, {});
    return getGoal(id, home);
  });
}
