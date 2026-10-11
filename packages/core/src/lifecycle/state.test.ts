import { expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { initLegacyHome as initHome, createProjectFixture } from '../test-support/runtime';
import { createGoal, activateGoal, dispatchRun, updateRunAttempt, getGoal } from '../index';
import { cursor, explainGoal, setRetryBudget } from './state';
import { openRuntimeDb, atomic } from '../db/client';
import { goalExecutions, goals, runs, runAttempts } from '../db/schema';
test('legacy history is reconciled once, including retries and previously unfinished goals', async () => {
  const home = await initHome(); const project = await createProjectFixture(home);
  const goal = await createGoal({ home, projectId: project.id, title: 'Reconcile' });
  const db = openRuntimeDb(home);
  expect((await explainGoal(goal.id, home)).state).toBe('draft');
  await activateGoal(goal.id, home);
  const run = await dispatchRun({ goalId: goal.id }, home);
  await updateRunAttempt(run.attemptId, { status: 'failed' }, home);
  await db.delete(goalExecutions).where(eq(goalExecutions.goalId, goal.id));
  expect((await atomic(home, () => cursor(goal.id, home))).attemptsUsed).toBe(1);
  const retry = await dispatchRun({ goalId: goal.id }, home);
  await updateRunAttempt(retry.attemptId, { status: 'succeeded' }, home);
  await db.delete(goalExecutions).where(eq(goalExecutions.goalId, goal.id));
  expect((await explainGoal(goal.id, home)).state).toBe('ready');
  while ((await explainGoal(goal.id, home)).state === 'ready') {
    const next = await dispatchRun({ goalId: goal.id }, home);
    await updateRunAttempt(next.attemptId, { status: 'succeeded' }, home);
  }
  await db.update(goals).set({ status: 'active' }).where(eq(goals.id, goal.id));
  await db.delete(goalExecutions).where(eq(goalExecutions.goalId, goal.id));
  expect((await explainGoal(goal.id, home)).state).toBe('completed');
  expect((await getGoal(goal.id, home))?.status).toBe('completed');
  await expect(setRetryBudget(goal.id, 4, home)).rejects.toMatchObject({ code: 'TERMINAL_GOAL' });
});
test('missing execution positions are explicit blockers, never implicit completion', async () => {
  const home = await initHome(); const project = await createProjectFixture(home);
  const goal = await createGoal({ home, projectId: project.id, title: 'Damaged history' });
  await activateGoal(goal.id, home);
  await expect(setRetryBudget(goal.id, 0, home)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  const run = await dispatchRun({ goalId: goal.id }, home);
  const db = openRuntimeDb(home);
  await db.delete(runAttempts).where(eq(runAttempts.id, run.attemptId));
  expect((await explainGoal(goal.id, home)).reason).toBe('INCONSISTENT_HISTORY');
});

import { activations } from '../db/schema';
test('pre-activation-table history migrates failures and completed linear steps once', async () => {
  const home = await initHome(), project = await createProjectFixture(home);
  const goal = await createGoal({ home, projectId: project.id, title: 'Actual legacy snapshot' });
  await activateGoal(goal.id, home); const db = openRuntimeDb(home);
  const removeGraphState = async () => { await db.delete(activations).where(eq(activations.goalId, goal.id)); await db.delete(goalExecutions).where(eq(goalExecutions.goalId, goal.id)); await db.update(runs).set({ activationId: null }).where(eq(runs.goalId, goal.id)); };
  const run = await dispatchRun({ goalId: goal.id }, home); await updateRunAttempt(run.attemptId, { status: 'failed' }, home);
  await removeGraphState(); expect((await atomic(home, () => cursor(goal.id, home))).attemptsUsed).toBe(1);
  const retry = await dispatchRun({ goalId: goal.id }, home); await updateRunAttempt(retry.attemptId, { status: 'succeeded' }, home);
  await removeGraphState(); expect((await explainGoal(goal.id, home)).state).toBe('ready');
  while ((await explainGoal(goal.id, home)).state === 'ready') { const next = await dispatchRun({ goalId: goal.id }, home); await updateRunAttempt(next.attemptId, { status: 'succeeded' }, home); }
  await removeGraphState(); await db.update(goals).set({ status: 'active' }).where(eq(goals.id, goal.id));
  expect((await explainGoal(goal.id, home)).state).toBe('completed'); expect((await getGoal(goal.id, home))!.status).toBe('completed');
});
