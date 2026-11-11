import { expect, test } from 'bun:test';
import { asc, eq } from 'drizzle-orm';
import { atomic, openRuntimeDb } from '../db/client';
import { activations, goalExecutions, runAttempts, runs } from '../db/schema';
import { initLegacyHome, createProjectFixture } from '../test-support/runtime';
import { createGoal } from '../commands/goals/create';
import { activateGoal } from '../commands/goals/activate';
import { dispatchRun } from '../commands/runs/dispatch';
import { updateRunAttempt } from '../commands/attempts/update';
import { cursor, setRetryBudget } from './state';
import { createAgent, newSendero, publishSendero, createSenderos } from '../index';

async function fixture() {
  const home = await initLegacyHome(), project = await createProjectFixture(home);
  const goal = await createGoal({ home, projectId: project.id, title: 'Retained activation recovery' });
  await activateGoal(goal.id, home);
  const first = await dispatchRun({ goalId: goal.id }, home);
  await updateRunAttempt(first.attemptId, { status: 'succeeded', result: { summary: 'Keep predecessor facts' } }, home);
  const second = await dispatchRun({ goalId: goal.id }, home);
  await updateRunAttempt(second.attemptId, { status: 'failed', checkpoint: 'Retain recovery checkpoint' }, home);
  await setRetryBudget(goal.id, 5, home);
  return { home, goal, first, second, db: openRuntimeDb(home) };
}

for (const reverse of [false, true]) test(`missing cursor preserves latest activation and successor budget with reverse insertion=${reverse}`, async () => {
  const { home, goal, first, second, db } = await fixture();
  const visits = await db.select().from(activations).where(eq(activations.goalId, goal.id));
  const selected = visits.find(a => a.latestRunId === second.runId)!;
  // Explicit timestamps ensure this test does not depend on the clock's precision.
  await db.update(runs).set({ createdAt: '2026-01-01T00:00:00.000Z' }).where(eq(runs.id, first.runId));
  await db.update(runs).set({ createdAt: '2026-01-02T00:00:00.000Z' }).where(eq(runs.id, second.runId));
  const history = await db.select().from(runAttempts).orderBy(asc(runAttempts.id));
  await db.delete(activations).where(eq(activations.goalId, goal.id));
  for (const visit of reverse ? [...visits].reverse() : visits) await db.insert(activations).values(visit);
  await db.delete(goalExecutions).where(eq(goalExecutions.goalId, goal.id));
  const recovered = await atomic(home, () => cursor(goal.id, home));
  expect(recovered).toMatchObject({ latestRunId: second.runId, transitionId: selected.transitionId, attemptsUsed: 1, maxAttempts: 5, activationsUsed: 2 });
  expect(await atomic(home, () => cursor(goal.id, home))).toEqual(recovered);
  expect(await db.select().from(activations).orderBy(asc(activations.id))).toEqual([...visits].sort((a, b) => a.id.localeCompare(b.id)));
  expect(await db.select().from(runAttempts).orderBy(asc(runAttempts.id))).toEqual(history);
  const retry = await dispatchRun({ goalId: goal.id }, home);
  const retryAttempt = (await db.select().from(runAttempts).where(eq(runAttempts.id, retry.attemptId)))[0]!;
  expect(retryAttempt.retryFromAttemptId).toBe(second.attemptId);
  await updateRunAttempt(retry.attemptId, { status: 'succeeded' }, home);
  expect((await db.select().from(activations)).find(a => a.status === 'ready')?.maxAttempts).toBe(5);
});

test('missing cursor uses the established run ID tiebreaker rather than activation insertion order', async () => {
  const { home, goal, first, second, db } = await fixture();
  await db.update(runs).set({ createdAt: '2026-01-01T00:00:00.000Z' });
  const visits = await db.select().from(activations);
  const latestId = [first.runId, second.runId].sort().at(-1)!;
  const selected = visits.find(a => a.latestRunId === latestId)!;
  await db.delete(activations);
  for (const visit of [...visits].sort((a, b) => a.latestRunId! > b.latestRunId! ? -1 : 1)) await db.insert(activations).values(visit);
  await db.delete(goalExecutions).where(eq(goalExecutions.goalId, goal.id));
  expect(await atomic(home, () => cursor(goal.id, home))).toMatchObject({ latestRunId: latestId, transitionId: selected.transitionId, attemptsUsed: selected.attemptsUsed, maxAttempts: 5 });
});

test('recovery preserves a budget changed on ready successors after the latest run settled', async () => {
  const { home, goal, second, db } = await fixture();
  const retry = await dispatchRun({ goalId: goal.id }, home);
  await updateRunAttempt(retry.attemptId, { status: 'succeeded' }, home);
  await setRetryBudget(goal.id, 7, home);
  await db.delete(goalExecutions).where(eq(goalExecutions.goalId, goal.id));
  expect(await atomic(home, () => cursor(goal.id, home))).toMatchObject({ latestRunId: retry.runId, maxAttempts: 7 });
  const next = await dispatchRun({ goalId: goal.id }, home);
  expect(next.runId).not.toBe(second.runId);
  expect((await db.select().from(runs).where(eq(runs.id, next.runId)))[0]?.maxAttempts).toBe(7);
});

for (const damage of ['missing-run', 'missing-association'] as const) test(`recovery rejects ${damage} without committing a fabricated cursor`, async () => {
  const { home, goal, second, db } = await fixture();
  await db.update(runs).set({ createdAt: '2099-01-01T00:00:00.000Z' }).where(eq(runs.id, second.runId));
  if (damage === 'missing-run') await db.delete(runs).where(eq(runs.id, second.runId));
  else await db.update(runs).set({ activationId: null }).where(eq(runs.id, second.runId));
  await db.delete(goalExecutions).where(eq(goalExecutions.goalId, goal.id));
  await expect(atomic(home, () => cursor(goal.id, home))).rejects.toMatchObject({ code: 'INCONSISTENT_HISTORY' });
  expect(await db.select().from(goalExecutions).where(eq(goalExecutions.goalId, goal.id))).toHaveLength(0);
});

test('ready activations preserve the configured budget before the first run', async () => {
  const home = await initLegacyHome(), project = await createProjectFixture(home);
  const goal = await createGoal({ home, projectId: project.id, title: 'Ready recovery' });
  await activateGoal(goal.id, home);
  await setRetryBudget(goal.id, 8, home);
  const db = openRuntimeDb(home), before = await db.select().from(activations);
  await db.delete(goalExecutions).where(eq(goalExecutions.goalId, goal.id));
  expect(await atomic(home, () => cursor(goal.id, home))).toMatchObject({ latestRunId: null, attemptsUsed: 0, maxAttempts: 8, activationsUsed: 1 });
  expect(await db.select().from(activations)).toEqual(before);
  expect((await dispatchRun({ goalId: goal.id }, home)).runId).toBeDefined();
});


test('parallel recovery retains both branches and rejects conflicting unfinished budgets atomically', async () => {
  const home = await initLegacyHome(), project = await createProjectFixture(home);
  const agent = await createAgent({ home, slug: 'parallel-recovery', name: 'Worker', instructions: 'Synthetic local fixture' });
  await newSendero({ home, slug: 'parallel-recovery', name: 'Parallel recovery', nodes: [
    { key: 'start', kind: 'start', label: 'Start' }, { key: 'end', kind: 'end', label: 'End' },
    ...['left', 'right'].map(key => ({ key, label: key, kind: 'agent' as const, agentId: agent.id, executionObjective: key })),
  ], edges: [ { source: 'start', target: 'left' }, { source: 'start', target: 'right' }, { source: 'left', target: 'end' }, { source: 'right', target: 'end' } ] });
  const graph = (await publishSendero('parallel-recovery', home))!;
  const goal = await createGoal({ home, projectId: project.id, title: 'Parallel retained recovery', senderoVersionId: graph.version.id });
  await activateGoal(goal.id, home);
  await setRetryBudget(goal.id, 6, home);
  const db = openRuntimeDb(home), visits = await db.select().from(activations);
  const left = await dispatchRun({ goalId: goal.id, activationId: visits[0]!.id }, home);
  const right = await dispatchRun({ goalId: goal.id, activationId: visits[1]!.id }, home);
  await db.update(runs).set({ createdAt: '2026-01-01T00:00:00.000Z' }).where(eq(runs.id, left.runId));
  await db.update(runs).set({ createdAt: '2026-01-02T00:00:00.000Z' }).where(eq(runs.id, right.runId));
  const before = await db.select().from(activations).orderBy(asc(activations.id));
  await db.delete(goalExecutions).where(eq(goalExecutions.goalId, goal.id));
  const foreign = createSenderos({ home, executionContextId: 'foreign-recovery-context' });
  await expect(foreign.commands.goals.explain(goal.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  expect(await db.select().from(goalExecutions)).toHaveLength(0);
  expect(await atomic(home, () => cursor(goal.id, home))).toMatchObject({ latestRunId: right.runId, maxAttempts: 6, activationsUsed: 2 });
  expect(await db.select().from(activations).orderBy(asc(activations.id))).toEqual(before);
  await db.delete(goalExecutions).where(eq(goalExecutions.goalId, goal.id));
  await db.update(activations).set({ maxAttempts: 9 }).where(eq(activations.id, visits[0]!.id));
  await expect(atomic(home, () => cursor(goal.id, home))).rejects.toMatchObject({ code: 'INCONSISTENT_HISTORY' });
  expect(await db.select().from(goalExecutions)).toHaveLength(0);
});
