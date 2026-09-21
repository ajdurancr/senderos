import { openRuntimeDb } from "../../db/client";
import { goals, projects, runs } from "../../db/schema";
import type { RunRecord } from "../../shared/types";
import { and, eq } from "drizzle-orm";
export async function getRun(
  id: string,
  home?: string,
  executionContextId?: string,
): Promise<RunRecord | null> {
  const db = openRuntimeDb(home);
  if (executionContextId) {
    const row = (await db.select({ run: runs }).from(runs)
      .innerJoin(goals, eq(runs.goalId, goals.id))
      .innerJoin(projects, eq(goals.projectId, projects.id))
      .where(and(eq(runs.id, id), eq(projects.executionContextId, executionContextId))))[0];
    return (row?.run as RunRecord | undefined) ?? null;
  }
  const row = (await db.select().from(runs).where(eq(runs.id, id)))[0];
  return (row as RunRecord | undefined) ?? null;
}
