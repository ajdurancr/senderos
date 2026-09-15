import { openRuntimeDb } from "../../db/client";
import type { GoalRecord } from "../../shared/types";
import { goals, projects } from "../../db/schema";
import { and, eq } from "drizzle-orm";

export async function getGoal(id: string, home?: string, executionContextId?: string) {
  const db = openRuntimeDb(home);
  if (executionContextId) {
    const row = (await db.select({ goal: goals }).from(goals)
      .innerJoin(projects, eq(goals.projectId, projects.id))
      .where(and(eq(goals.id, id), eq(projects.executionContextId, executionContextId))))[0];
    return (row?.goal as GoalRecord | undefined) ?? null;
  }
  return (
    ((await db.select().from(goals).where(eq(goals.id, id)))[0] as
      | GoalRecord
      | undefined) ?? null
  );
}
