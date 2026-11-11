import { openRuntimeDb } from "../../db/client";
import { goals, projects } from "../../db/schema";
import type { GoalRecord } from "../../shared/types";
import { and, asc, eq } from "drizzle-orm";

export async function listGoals(home?: string, executionContextId?: string, projectId?: string): Promise<GoalRecord[]> {
  const db = openRuntimeDb(home);
  if (!executionContextId)
    return (await db.select().from(goals).where(projectId ? eq(goals.projectId, projectId) : undefined).orderBy(asc(goals.createdAt))) as GoalRecord[];
  const rows = await db.select({ goal: goals }).from(goals)
    .innerJoin(projects, eq(goals.projectId, projects.id))
    .where(and(eq(projects.executionContextId, executionContextId), projectId ? eq(goals.projectId, projectId) : undefined))
    .orderBy(asc(goals.createdAt));
  return rows.map((row) => row.goal) as GoalRecord[];
}
