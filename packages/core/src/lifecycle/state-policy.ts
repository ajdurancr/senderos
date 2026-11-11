import { and, eq, inArray, max, min } from 'drizzle-orm';
import { openRuntimeDb } from '../db/client';
import { attemptClaims, events, goals, runAttempts, runs } from '../db/schema';
import { requireLifecycle } from './errors';

/** Called inside cursor's transaction after requireGoal has checked access. */
export async function recoverCursorPolicy(goal: typeof goals.$inferSelect, defaults: { maxActivations: number; activationsUsed: number }, home?: string) {
  const db = openRuntimeDb(home);
  const budgetScope = and(eq(events.entityType, 'goal'), eq(events.entityId, goal.id), eq(events.eventType, 'goal.activation-budget-updated'));
  const latestBudgetTime = db.select({ value: max(events.createdAt) }).from(events).where(budgetScope);
  // Read every edit at the latest timestamp: random event IDs cannot prove order.
  const edits = await db.select({ payload: events.payloadJson }).from(events)
    .where(and(budgetScope, eq(events.createdAt, latestBudgetTime)));
  const limits = edits.map(edit => {
    let value: unknown;
    try { value = JSON.parse(edit.payload)?.maxActivations; } catch { /* Reject below, without a partial cursor. */ }
    requireLifecycle(typeof value === 'number' && Number.isInteger(value) && value >= Math.max(1, defaults.activationsUsed) && value <= 10000, 'INCONSISTENT_HISTORY', 'Recorded activation budget is invalid; reconcile history before continuing');
    return value;
  });
  const maxActivations = limits[0] ?? Math.max(defaults.maxActivations, defaults.activationsUsed);
  requireLifecycle(limits.every(limit => limit === maxActivations), 'INCONSISTENT_HISTORY', 'Recorded activation budgets have ambiguous ordering; reconcile history before continuing');
  const [claim] = await db.select({ requestedAt: min(attemptClaims.cancellationRequestedAt) }).from(attemptClaims)
    .innerJoin(runAttempts, eq(runAttempts.id, attemptClaims.attemptId))
    .innerJoin(runs, eq(runs.id, runAttempts.runId)).where(eq(runs.goalId, goal.id));
  const [event] = await db.select({ requestedAt: min(events.createdAt) }).from(events)
    .where(and(eq(events.entityType, 'goal'), eq(events.entityId, goal.id), inArray(events.eventType, ['goal.cancellation-requested', 'goal.canceled'])));
  const signals = [claim?.requestedAt, event?.requestedAt, goal.status === 'canceled' ? goal.updatedAt : null].filter((value): value is string => value != null);
  requireLifecycle(signals.every(value => Number.isFinite(Date.parse(value))), 'INCONSISTENT_HISTORY', 'Recorded cancellation time is invalid; reconcile history before continuing');
  const cancellationRequestedAt = signals.sort((a, b) => Date.parse(a) - Date.parse(b))[0] ?? null;
  return { maxActivations, cancellationRequestedAt };
}

/** Legacy histories have no activation carrying edits made after reservation. */
export async function recoverLegacyRetryBudget(goalId: string, fallback: number, home?: string) {
  const db = openRuntimeDb(home);
  const scope = and(eq(events.entityType, 'goal'), eq(events.entityId, goalId), eq(events.eventType, 'goal.retry-budget-updated'));
  const latestTime = db.select({ value: max(events.createdAt) }).from(events).where(scope);
  const edits = await db.select({ payload: events.payloadJson }).from(events).where(and(scope, eq(events.createdAt, latestTime)));
  const limits = edits.map(edit => {
    let value: unknown;
    try { value = JSON.parse(edit.payload)?.maxAttempts; } catch { /* Reject without a partial migration. */ }
    requireLifecycle(typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 100, 'INCONSISTENT_HISTORY', 'Recorded retry budget is invalid; reconcile history before continuing');
    return value;
  });
  const maxAttempts = limits[0] ?? fallback;
  requireLifecycle(limits.every(limit => limit === maxAttempts), 'INCONSISTENT_HISTORY', 'Recorded retry budgets have ambiguous ordering; reconcile history before continuing');
  return maxAttempts;
}
