import { expect, spyOn, test } from 'bun:test';
import type { InStatement, ResultSet } from '@libsql/client';
import { asc, eq } from 'drizzle-orm';
import { atomic, openRuntimeDb } from '../db/client';
import { activations, goalExecutions, goals, runAttempts, runs } from '../db/schema';
import { createGoal } from '../commands/goals/create';
import { createRunRecord } from '../commands/runs/create';
import { createRunAttempt } from '../commands/attempts/create';
import { createProjectFixture, initLegacyHome } from '../test-support/runtime';
import { executableGraph } from './route';
import { cursor } from './state';

async function legacyFixture(latestStatus: string) {
  const home = await initLegacyHome(), project = await createProjectFixture(home);
  const goal = await createGoal({ home, projectId: project.id, title: 'Legacy recovery' });
  const db = openRuntimeDb(home), graph = await executableGraph(goal.senderoVersionId, home, false);
  await db.update(goals).set({ status: 'active' }).where(eq(goals.id, goal.id));
  const seedRun = (await createRunRecord(goal, home))!;
  await db.delete(runs).where(eq(runs.id, seedRun.id));
  // Tied creation times deliberately make the ID the latest-run tiebreaker.
  for (const [id, status] of [['legacy-a', 'failed'], ['legacy-z', latestStatus]]) {
    await db.insert(runs).values({ ...seedRun, id: id!, status: status!, createdAt: '2000-01-01T00:00:00.000Z' });
  }
  const step = graph.steps[0]!;
  const first = await createRunAttempt({ home, runId: 'legacy-a', attemptNumber: 1, agentId: step.agentId, transitionId: step.id, executionObjective: 'Original', harness: 'custom-tool', status: 'failed' });
  const retry = await createRunAttempt({ home, runId: 'legacy-z', attemptNumber: 9, agentId: step.agentId, transitionId: step.id, executionObjective: 'Latest numbered retry', harness: 'custom-tool', status: 'failed', retryFromAttemptId: first.id });
  // Insert lower numbered attempts later: insertion order must not choose the transition.
  await createRunAttempt({ home, runId: 'legacy-z', attemptNumber: 2, agentId: step.agentId, transitionId: graph.steps[1]!.id, executionObjective: 'Another transition', harness: 'custom-tool', status: 'succeeded' });
  const other = await createProjectFixture(home, { name: 'Unrelated context', executionContextId: 'unrelated' });
  const otherGoal = await createGoal({ home, projectId: other.id, title: 'Unrelated goal' });
  const otherRun = (await createRunRecord(otherGoal, home))!;
  for (let i = 0; i < 40; i++) await db.insert(runAttempts).values({ ...first, id: `unrelated-${i}`, runId: otherRun.id, attemptNumber: i + 1, resultJson: JSON.stringify({ payload: 'Unrelated synthetic recovery data '.repeat(400) }) });
  // Missing parents must not contribute, even when the transition matches.
  await db.insert(runAttempts).values({ ...first, id: 'orphan', runId: 'missing' });
  return { home, db, goal, graph, first, retry };
}

for (const status of ['failed', 'canceled', 'executing']) test(`legacy ${status} recovery counts only selected transition history without materializing unrelated attempts`, async () => {
  const { home, db, goal, graph, first, retry } = await legacyFixture(status);
  const beforeAttempts = await db.select().from(runAttempts).orderBy(asc(runAttempts.id));
  const beforeRuns = await db.select().from(runs).orderBy(asc(runs.id));
  const attemptResults: ResultSet[] = [];
  const recovered = await atomic(home, async () => {
    const client = openRuntimeDb(home).$client;
    const execute = client.execute.bind(client) as (statement: InStatement) => Promise<ResultSet>;
    const spy = spyOn(client, 'execute').mockImplementation(async (...args) => {
      const result = await execute(args[0]);
      const sql = typeof args[0] === 'string' ? args[0] : args[0].sql;
      if (/from "run_attempts"/.test(sql)) attemptResults.push(result);
      return result;
    });
    try { return await cursor(goal.id, home); } finally { spy.mockRestore(); }
  });
  expect(recovered).toMatchObject({ goalId: goal.id, transitionId: graph.steps[0]!.id, attemptsUsed: 2, latestRunId: 'legacy-z', activationsUsed: 1 });
  const visits = await db.select().from(activations).where(eq(activations.goalId, goal.id));
  expect(visits).toHaveLength(1);
  expect(visits[0]).toMatchObject({ latestRunId: 'legacy-z', previousRunId: 'legacy-z', attemptsUsed: 2, status: status === 'executing' ? 'running' : 'failed' });
  expect(await db.select().from(runAttempts).orderBy(asc(runAttempts.id))).toEqual(beforeAttempts);
  expect(retry.retryFromAttemptId).toBe(first.id);
  expect(await db.select().from(runs).orderBy(asc(runs.id))).toEqual(beforeRuns.map(run => run.id === 'legacy-z' ? { ...run, activationId: visits[0]!.id } : run));
  expect(await atomic(home, () => cursor(goal.id, home))).toEqual(recovered);
  expect(await db.select().from(activations).where(eq(activations.goalId, goal.id))).toEqual(visits);
  // Assert the real driver response, not merely SQL text or final cursor parity.
  expect(attemptResults.map(result => result.rows.length)).toEqual([1, 1]);
  expect(attemptResults[1]!.columns).toEqual(['count(*)']);
  expect(Buffer.byteLength(JSON.stringify(attemptResults.map(result => result.rows)))).toBeLessThan(5_000);
});

test('legacy success advances from the latest numbered attempt without counting retries', async () => {
  const { home, db, goal, graph } = await legacyFixture('succeeded');
  const attempts = await db.select().from(runAttempts).orderBy(asc(runAttempts.id));
  expect(await atomic(home, () => cursor(goal.id, home))).toMatchObject({ transitionId: graph.steps[1]!.id, attemptsUsed: 0, latestRunId: 'legacy-z' });
  expect((await db.select().from(activations).where(eq(activations.goalId, goal.id)))[0]).toMatchObject({ status: 'ready', latestRunId: null, previousRunId: 'legacy-z' });
  expect(await db.select().from(runAttempts).orderBy(asc(runAttempts.id))).toEqual(attempts);
});

test('multiple active legacy runs reject recovery before persisting a cursor or activation', async () => {
  const { home, db, goal } = await legacyFixture('executing');
  await db.update(runs).set({ status: 'queued' }).where(eq(runs.id, 'legacy-a'));
  await expect(atomic(home, () => cursor(goal.id, home))).rejects.toMatchObject({ code: 'INCONSISTENT_HISTORY' });
  expect(await db.select().from(goalExecutions).where(eq(goalExecutions.goalId, goal.id))).toEqual([]);
  expect(await db.select().from(activations).where(eq(activations.goalId, goal.id))).toEqual([]);
});
