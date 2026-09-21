import { openRuntimeDb } from "../../db/client";
import type { RunAttemptRecord } from "../../shared/types";
import { goals, projects, runAttempts, runs } from "../../db/schema";
import { and, eq } from "drizzle-orm";

export async function getRunAttempt(id: string, home?: string, executionContextId?: string) {
  const db = openRuntimeDb(home);
  if (executionContextId) {
    const row = (await db.select({ attempt: runAttempts }).from(runAttempts)
      .innerJoin(runs, eq(runAttempts.runId, runs.id))
      .innerJoin(goals, eq(runs.goalId, goals.id))
      .innerJoin(projects, eq(goals.projectId, projects.id))
      .where(and(eq(runAttempts.id, id), eq(projects.executionContextId, executionContextId))))[0];
    return (row?.attempt as RunAttemptRecord | undefined) ?? null;
  }
  return (
    ((await db.select().from(runAttempts).where(eq(runAttempts.id, id)))[0] as
      | RunAttemptRecord
      | undefined) ?? null
  );
}
