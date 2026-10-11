import { AsyncLocalStorage } from "node:async_hooks";
import { eq } from "drizzle-orm";
import { openRuntimeDb } from "../db/client";
import { goals, projects, runs, runAttempts } from "../db/schema";
import { resolveExecutionContextId } from "../shared/config";
import { requireLifecycle } from "./errors";

const scopes = new AsyncLocalStorage<{ executionContextId?: string }>();
export function scopedApi<T extends object>(api: T, executionContextId?: string): T {
  return Object.fromEntries(Object.entries(api).map(([key, value]) => [key,
    typeof value === "function" ? (...args: unknown[]) => scopes.run({ executionContextId }, () => value(...args))
      : value && typeof value === "object" ? scopedApi(value, executionContextId) : value,
  ])) as T;
}
/** Returns the explicitly selected API scope, falling back to the local runtime. */
export function currentExecutionContextId(home?: string) {
  const context = scopes.getStore();
  return context ? context.executionContextId : home ? resolveExecutionContextId(home) : undefined;
}
export async function requireGoal(id: string, home?: string) {
  const db = openRuntimeDb(home);
  const goal = (await db.select().from(goals).where(eq(goals.id, id)))[0];
  const executionContextId = currentExecutionContextId(home);
  const project = goal && (await db.select().from(projects).where(eq(projects.id, goal.projectId)))[0];
  requireLifecycle(goal && project && (!executionContextId || project.executionContextId === executionContextId),
    "NOT_FOUND", `Goal not found in the current execution context: ${id}`);
  return goal;
}
export async function requireRun(id: string, home?: string) {
  const run = (await openRuntimeDb(home).select().from(runs).where(eq(runs.id, id)))[0];
  requireLifecycle(run, "NOT_FOUND", `Run not found: ${id}`);
  await requireGoal(run.goalId, home);
  return run;
}
export async function requireAttempt(id: string, home?: string) {
  const attempt = (await openRuntimeDb(home).select().from(runAttempts).where(eq(runAttempts.id, id)))[0];
  requireLifecycle(attempt, "NOT_FOUND", `Run attempt not found: ${id}`);
  await requireRun(attempt.runId, home);
  return attempt;
}
