import { eq } from "drizzle-orm";
import { atomic, openRuntimeDb } from "../../db/client";
import { activations, attemptClaims, goalExecutions, runAttempts, runs } from "../../db/schema";
import { now } from "../../shared/ids";
import { emitEvent } from "../../shared/events";
import type { RunAttemptRecord } from "../../shared/types";
import { requireAttempt, requireRun, requireGoal } from "../../lifecycle/scope";
import { requireLifecycle } from "../../lifecycle/errors";
import { cursor, terminal } from "../../lifecycle/state";
import { verifyOwner } from "../../lifecycle/hosts";
import { executableGraph, parseCondition } from "../../lifecycle/route";
import { activationForRun, enableSuccessors, settleGoal } from "../../lifecycle/activations";
import { isSettlingGate } from "../../lifecycle/gates";
import { enforceStartedAttempt } from "../../lifecycle/host-protocol";
import { withAttemptHostAccess } from "../../lifecycle/host-access";
import { cancelGoal } from "../goals/cancel";
import { isDeepStrictEqual } from "node:util";
export type AttemptUpdate = Partial<Pick<RunAttemptRecord, "status" | "checkpoint" | "workingPath" | "workingPathMode" | "externalSessionId" | "resumeCommand" | "heartbeatAt" | "failureStep" | "failureSummary" | "finishedAt" | "harness" | "hostEnvironmentName">> & { token?: string; result?: Record<string, unknown>; statusSnapshot?: Record<string, unknown> };
export async function updateRunAttempt(id: string, input: AttemptUpdate, home?: string) {
  return withAttemptHostAccess(id, input.token, home, () => atomic(home, async () => {
    requireLifecycle(input.result === undefined || input.result !== null && typeof input.result === "object" && !Array.isArray(input.result), "INVALID_INPUT", "Result must be a JSON object");
    requireLifecycle(input.statusSnapshot === undefined || input.statusSnapshot !== null && typeof input.statusSnapshot === "object" && !Array.isArray(input.statusSnapshot), "INVALID_INPUT", "Status snapshot must be a JSON object");
    const current = await requireAttempt(id, home), run = await requireRun(current.runId, home), goal = await requireGoal(run.goalId, home);
    const db = openRuntimeDb(home);
    const claim = isSettlingGate() ? (await db.select().from(attemptClaims).where(eq(attemptClaims.attemptId, id)))[0] : await verifyOwner(id, input.token, home, terminal(current.status) || input.status === "canceled");
    if (terminal(current.status)) {
      requireLifecycle(!input.status || input.status === current.status, "TERMINAL_ATTEMPT", "Finished attempts cannot change status");
      requireLifecycle(!input.result || isDeepStrictEqual(input.result, JSON.parse(current.resultJson)), "RESULT_CONFLICT", "Finished result is immutable");
      return current as RunAttemptRecord;
    }
    enforceStartedAttempt(current, input, claim);
    requireLifecycle(!["completed", "canceled"].includes(goal.status) || input.status === "canceled", "TERMINAL_GOAL", "Goal is terminal");
    requireLifecycle(!claim?.cancellationRequestedAt || input.status === "canceled", "CANCELLATION_REQUESTED", "Stop execution and report canceled");
    const state = await cursor(goal.id, home), activation = await activationForRun(run.id, home);
    requireLifecycle(activation && activation.latestRunId === run.id, "STALE_ATTEMPT", "Attempt was superseded");
    requireLifecycle(!input.status || ["running", "paused", "succeeded", "failed", "canceled"].includes(input.status), "INVALID_STATUS", "Invalid attempt transition");
    const snapshot = JSON.parse(current.statusSnapshotJson);
    if (snapshot.completionRequested) {
      requireLifecycle(!input.status || ["succeeded", "failed", "canceled"].includes(input.status), "COMPLETION_PENDING", "Execution is finished; settle review/evidence or fail/cancel before retrying");
      requireLifecycle(!input.result || isDeepStrictEqual(input.result, JSON.parse(current.resultJson)), "RESULT_CONFLICT", "Result submitted for completion is immutable");
    }
    requireLifecycle(!input.statusSnapshot || !Object.keys(input.statusSnapshot).some(k => ["review", "evidence", "completionRequested", "hostPreflight"].includes(k)), "INVALID_INPUT", "Use review/evidence commands for completion gates");
    const merged = { ...snapshot, ...input.statusSnapshot }, result = input.result ?? JSON.parse(current.resultJson);
    let status = input.status ?? current.status;
    const graph = await executableGraph(goal.senderoVersionId, home, false), step = graph.steps.find(s => s.nodeId === activation.nodeId)!;
    if (status === "succeeded") {
      requireLifecycle(graph.edges.some(e => e.sourceNodeId === step.nodeId && (!parseCondition(e.conditionJson).outcome || parseCondition(e.conditionJson).outcome === result.outcome)), "NO_MATCHING_EDGE", "No outgoing edge matches result.outcome; report a configured outcome");
      const evidence = Array.isArray(merged.evidence) ? merged.evidence : [];
      const allowed = (!step.policy.requireReview || merged.review?.status === "approved") && (step.policy.evidenceKinds ?? []).every(kind => evidence.some((e: { kind: string }) => e.kind === kind));
      if (!allowed) { status = "paused"; merged.completionRequested = true; }

    }
    const ts = now();
    await db.update(runAttempts).set({ status, checkpoint: input.checkpoint ?? current.checkpoint, workingPath: input.workingPath ?? current.workingPath, workingPathMode: input.workingPathMode ?? current.workingPathMode, externalSessionId: input.externalSessionId ?? current.externalSessionId, resumeCommand: input.resumeCommand ?? current.resumeCommand, heartbeatAt: input.heartbeatAt ?? current.heartbeatAt, harness: input.harness ?? current.harness, hostEnvironmentName: input.hostEnvironmentName ?? current.hostEnvironmentName, failureStep: input.failureStep ?? current.failureStep, failureSummary: input.failureSummary ?? current.failureSummary, resultJson: JSON.stringify(result), statusSnapshotJson: JSON.stringify(merged), startedAt: status === "running" ? current.startedAt ?? ts : current.startedAt, finishedAt: terminal(status) ? ts : null, updatedAt: ts }).where(eq(runAttempts.id, id));
    if (terminal(status)) {
      await db.update(runs).set({ status, updatedAt: ts }).where(eq(runs.id, run.id));
      if (status === "succeeded") await enableSuccessors({ goalId: goal.id, graph, sourceNodeId: activation.nodeId, parent: activation, result, snapshot: merged }, home);
      else await db.update(activations).set({ status: status === "canceled" ? "canceled" : "failed", revision: activation.revision + 1, updatedAt: ts }).where(eq(activations.id, activation.id));
      await db.update(goalExecutions).set({ revision: state.revision + 1, attemptsUsed: status === "succeeded" ? 0 : activation.attemptsUsed }).where(eq(goalExecutions.goalId, goal.id));
      if (status === "canceled") { if (!state.cancellationRequestedAt) await cancelGoal(goal.id, home); await db.update(attemptClaims).set({ acknowledgedAt: ts }).where(eq(attemptClaims.attemptId, id)); if (!state.cancellationRequestedAt) await db.update(goalExecutions).set({ cancellationRequestedAt: ts }).where(eq(goalExecutions.goalId, goal.id)); }
      await settleGoal(goal.id, graph, home);
      await emitEvent(db, `goal.step-${status}`, "goal", goal.id, { attemptId: id, activationId: activation.id });
    }
    await emitEvent(db, "run-attempt.updated", "run-attempt", id, { status, checkpoint: input.checkpoint });
    return (await db.select().from(runAttempts).where(eq(runAttempts.id, id)))[0] as RunAttemptRecord;
  }));
}
