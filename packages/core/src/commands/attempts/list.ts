import { openRuntimeDb } from "../../db/client";
import { goals, projects, runAttempts, runs } from "../../db/schema";
import type { RunAttemptRecord } from "../../shared/types";
import { and, asc, eq } from "drizzle-orm";

export async function listRunAttempts(
  runId?: string,
  home?: string,
  executionContextId?: string,
): Promise<RunAttemptRecord[]> {
  const db = openRuntimeDb(home);
  if (executionContextId) {
    const rows = await db.select({ attempt: runAttempts }).from(runAttempts)
      .innerJoin(runs, eq(runAttempts.runId, runs.id))
      .innerJoin(goals, eq(runs.goalId, goals.id))
      .innerJoin(projects, eq(goals.projectId, projects.id))
      .where(runId
        ? and(eq(runAttempts.runId, runId), eq(projects.executionContextId, executionContextId))
        : eq(projects.executionContextId, executionContextId))
      .orderBy(runId ? asc(runAttempts.attemptNumber) : asc(runAttempts.createdAt));
    return rows.map((row) => row.attempt) as RunAttemptRecord[];
  }
  const query = db.select().from(runAttempts);
  return (await (runId
    ? query
        .where(eq(runAttempts.runId, runId))
        .orderBy(asc(runAttempts.attemptNumber))
    : query.orderBy(asc(runAttempts.createdAt)))) as RunAttemptRecord[];
}
