import { openRuntimeDb } from "../../db/client";
import { now } from "../../shared/ids";
import { emitEvent } from "../../shared/events";
import type { RunAttemptRecord } from "../../shared/types";
import { getRunAttempt } from "./get";
import { goals, runAttempts, runs } from "../../db/schema";
import { eq } from "drizzle-orm";

export async function updateRunAttempt(
  id: string,
  input: Partial<
    Pick<
      RunAttemptRecord,
      | "status"
      | "checkpoint"
      | "workingPath"
      | "workingPathMode"
      | "externalSessionId"
      | "resumeCommand"
      | "heartbeatAt"
      | "failureStep"
      | "failureSummary"
      | "finishedAt"
    >
  > & {
    result?: Record<string, unknown>;
    statusSnapshot?: Record<string, unknown>;
  },
  home?: string,
) {
  const current = await getRunAttempt(id, home);
  if (!current) throw new Error(`Run attempt not found: ${id}`);
  const db = openRuntimeDb(home);
  await db
    .update(runAttempts)
    .set({
      status: input.status ?? current.status,
      checkpoint: input.checkpoint ?? current.checkpoint,
      workingPath: input.workingPath ?? current.workingPath,
      workingPathMode: input.workingPathMode ?? current.workingPathMode,
      externalSessionId: input.externalSessionId ?? current.externalSessionId,
      resumeCommand: input.resumeCommand ?? current.resumeCommand,
      heartbeatAt: input.heartbeatAt ?? current.heartbeatAt,
      failureStep: input.failureStep ?? current.failureStep,
      failureSummary: input.failureSummary ?? current.failureSummary,
      resultJson: JSON.stringify(
        input.result ?? JSON.parse(current.resultJson),
      ),
      statusSnapshotJson: JSON.stringify(
        input.statusSnapshot ?? JSON.parse(current.statusSnapshotJson),
      ),
      finishedAt: input.finishedAt ?? current.finishedAt,
      updatedAt: now(),
    })
    .where(eq(runAttempts.id, id));
  await emitEvent(db, "run-attempt.updated", "run-attempt", id, {
    status: input.status,
    checkpoint: input.checkpoint,
    failureStep: input.failureStep,
    hasResult: input.result !== undefined,
    hasStatusSnapshot: input.statusSnapshot !== undefined,
  });
  if (
    input.status &&
    ["succeeded", "failed", "canceled"].includes(input.status)
  ) {
    await db
      .update(runs)
      .set({
        status: input.status === "succeeded" ? "succeeded" : input.status,
        updatedAt: now(),
      })
      .where(eq(runs.id, current.runId));
    if (input.status === "failed") {
      const run = (
        await db
          .select({ goalId: runs.goalId })
          .from(runs)
          .where(eq(runs.id, current.runId))
      )[0];
      if (run)
        await db
          .update(goals)
          .set({ status: "failed", updatedAt: now() })
          .where(eq(goals.id, run.goalId));
    }
  }
  return getRunAttempt(id, home);
}
