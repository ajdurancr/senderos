import { openRuntimeDb } from '../../db/client';
import { emitEvent } from '../../shared/events';
import { now } from '../../shared/ids';
import { getGoal } from './get';
import { goals, runAttempts, runs } from '../../db/schema';
import { and, eq, inArray, notInArray } from 'drizzle-orm';

export async function cancelGoal(id: string, home?: string) {
  if (!(await getGoal(id, home))) throw new Error(`Goal not found: ${id}`);
  const db = openRuntimeDb(home);
  const ts = now();
  const goalRuns = await db.select({ id: runs.id }).from(runs).where(eq(runs.goalId, id));
  await db.update(goals).set({ status: 'canceled', updatedAt: ts }).where(eq(goals.id, id));
  await db.update(runs).set({ status: 'canceled', updatedAt: ts }).where(and(eq(runs.goalId, id), notInArray(runs.status, ['succeeded', 'failed', 'canceled'])));
  if (goalRuns.length) await db.update(runAttempts).set({ status: 'canceled', finishedAt: ts, updatedAt: ts }).where(and(inArray(runAttempts.runId, goalRuns.map((run) => run.id)), inArray(runAttempts.status, ['queued', 'running', 'paused'])));
  await emitEvent(db, 'goal.canceled', 'goal', id, {});
  return getGoal(id, home);
}
