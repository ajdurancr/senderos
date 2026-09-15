import { openRuntimeDb } from "../../db/client";
import { goals, projects, runs } from "../../db/schema";
import { asc, eq } from "drizzle-orm";
import type { RunRecord } from "../../shared/types";
export async function listRuns(home?: string, executionContextId?: string) {
  const db = openRuntimeDb(home);
  if (executionContextId) {
    const rows = await db.select({ run: runs }).from(runs)
      .innerJoin(goals, eq(runs.goalId, goals.id))
      .innerJoin(projects, eq(goals.projectId, projects.id))
      .where(eq(projects.executionContextId, executionContextId))
      .orderBy(asc(runs.createdAt));
    return rows.map((row) => row.run) as RunRecord[];
  }
  const rows = await db.select().from(runs).orderBy(asc(runs.createdAt));
  return rows as RunRecord[];
}
