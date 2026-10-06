import { eq } from "drizzle-orm";
import { atomic, openRuntimeDb } from "../../db/client";
import { attemptClaims, goalExecutions, goals, runAttempts, runs } from "../../db/schema";
import { now } from "../../shared/ids";
import { emitEvent } from "../../shared/events";
import type { RunAttemptRecord } from "../../shared/types";
import { requireAttempt, requireRun, requireGoal } from "../../lifecycle/scope";
import { requireLifecycle } from "../../lifecycle/errors";
import { cursor, terminal } from "../../lifecycle/state";
import { verifyOwner } from "../../lifecycle/hosts";
import { route } from "../../lifecycle/route";
import { isSettlingGate } from "../../lifecycle/gates";
import { isDeepStrictEqual } from 'node:util';

export type AttemptUpdate = Partial<Pick<RunAttemptRecord, "status" | "checkpoint" | "workingPath" | "workingPathMode" | "externalSessionId" | "resumeCommand" | "heartbeatAt" | "failureStep" | "failureSummary" | "finishedAt">> & {
  token?: string; result?: Record<string, unknown>; statusSnapshot?: Record<string, unknown>;
};
export async function updateRunAttempt(id: string, input: AttemptUpdate, home?: string) {
  return atomic(home, async () => {
    const current = await requireAttempt(id, home);
    const run = await requireRun(current.runId, home);
    const goal = await requireGoal(run.goalId, home);
    const claim = isSettlingGate()
      ? (await openRuntimeDb(home).select().from(attemptClaims).where(eq(attemptClaims.attemptId, id)))[0]
      : await verifyOwner(id, input.token, home, terminal(current.status) || input.status === "canceled");
    if (terminal(current.status)) {
      requireLifecycle(!input.status || input.status === current.status, "TERMINAL_ATTEMPT", "Finished attempts cannot change status");
      requireLifecycle(!input.result || isDeepStrictEqual(input.result, JSON.parse(current.resultJson)), "RESULT_CONFLICT", "Finished result is immutable");
      return current as RunAttemptRecord;
    }
    requireLifecycle(!["completed", "canceled"].includes(goal.status) || input.status === "canceled", "TERMINAL_GOAL", "Goal is terminal");
    requireLifecycle(!claim?.cancellationRequestedAt || input.status === "canceled", "CANCELLATION_REQUESTED", "Stop execution and report canceled");
    const state = await cursor(goal.id, home);
    requireLifecycle(state.latestRunId === run.id, "STALE_ATTEMPT", "Attempt was superseded");
    requireLifecycle(!input.status || ["running", "paused", "succeeded", "failed", "canceled"].includes(input.status), "INVALID_STATUS", "Invalid attempt transition");
    const snapshot = JSON.parse(current.statusSnapshotJson);
    // Review and evidence are written only through their dedicated commands.
    requireLifecycle(!input.statusSnapshot || !Object.keys(input.statusSnapshot).some(k => ["review", "evidence", "completionRequested"].includes(k)), "INVALID_INPUT", "Use review/evidence commands for completion gates");
    const merged = { ...snapshot, ...input.statusSnapshot };
    let status = input.status ?? current.status;
    const db = openRuntimeDb(home);
    const steps = input.status === "succeeded" ? await route(goal.senderoVersionId, home, false) : [];
    const index = steps.findIndex(s => s.id === current.transitionId);
    if (status === "succeeded") {
      requireLifecycle(index >= 0, "INVALID_WORKFLOW", "Attempt is not on the pinned route");
      const policy = steps[index]!.policy;
      const evidence = Array.isArray(merged.evidence) ? merged.evidence : [];
      const allowed = (!policy.requireReview || merged.review?.status === "approved") && (policy.evidenceKinds ?? []).every(kind => evidence.some((e: { kind: string }) => e.kind === kind));
      if (!allowed) { status = "paused"; merged.completionRequested = true; }
    }
    const ts = now();
    await db.update(runAttempts).set({
      status, checkpoint: input.checkpoint ?? current.checkpoint, workingPath: input.workingPath ?? current.workingPath,
      workingPathMode: input.workingPathMode ?? current.workingPathMode, externalSessionId: input.externalSessionId ?? current.externalSessionId,
      resumeCommand: input.resumeCommand ?? current.resumeCommand, heartbeatAt: input.heartbeatAt ?? current.heartbeatAt,
      failureStep: input.failureStep ?? current.failureStep, failureSummary: input.failureSummary ?? current.failureSummary,
      resultJson: input.result ? JSON.stringify(input.result) : current.resultJson, statusSnapshotJson: JSON.stringify(merged),
      finishedAt: terminal(status) ? ts : null, updatedAt: ts,
    }).where(eq(runAttempts.id, id));
    if (terminal(status)) {
      await db.update(runs).set({ status, updatedAt: ts }).where(eq(runs.id, run.id));
      const completed = status === "succeeded" && index === steps.length - 1;
      await db.update(goals).set({ status: completed ? "completed" : status === "succeeded" ? "active" : status, updatedAt: ts }).where(eq(goals.id, goal.id));
      await db.update(goalExecutions).set({
        transitionId: status === "succeeded" ? steps[index + 1]?.id ?? null : state.transitionId,
        attemptsUsed: status === "succeeded" ? 0 : state.attemptsUsed,
        revision: state.revision + 1, finishedAt: completed || status === "canceled" ? ts : null,
      }).where(eq(goalExecutions.goalId, goal.id));
      if (status === "canceled") await db.update(attemptClaims).set({ acknowledgedAt: ts }).where(eq(attemptClaims.attemptId, id));
      await emitEvent(db, completed ? "goal.completed" : `goal.step-${status}`, "goal", goal.id, { attemptId: id });
    }
    await emitEvent(db, "run-attempt.updated", "run-attempt", id, { status, checkpoint: input.checkpoint });
    return (await db.select().from(runAttempts).where(eq(runAttempts.id, id)))[0] as RunAttemptRecord;
  });
}
