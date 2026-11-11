import { expect, test } from 'bun:test';
import { asc, eq } from 'drizzle-orm';
import { openRuntimeDb } from '../../db/client';
import { events, goals, runAttempts, runs } from '../../db/schema';
import { createGoal } from '../goals/create';
import { createRunAttempt } from '../attempts/create';
import { createProjectFixture, initLegacyHome } from '../../test-support/runtime';
import { cursor } from '../../lifecycle/state';
import { scopedApi } from '../../lifecycle/scope';
import { executableGraph } from '../../lifecycle/route';
import { createRunRecord } from './create';
import { latestRunForGoal } from './latest-for-goal';
import { showRunState } from './show-state';

for (const insertionOrder of [['tie-a', 'tie-z'], ['tie-z', 'tie-a']]) {
  test(`run inspection agrees with legacy recovery for tied timestamps inserted ${insertionOrder.join(', ')}`, async () => {
    const home = await initLegacyHome(), project = await createProjectFixture(home);
    const goal = await createGoal({ home, projectId: project.id, title: 'Tied run history' });
    const db = openRuntimeDb(home), seed = (await createRunRecord(goal, home))!;
    await db.update(goals).set({ status: 'active' }).where(eq(goals.id, goal.id));
    await db.delete(runs).where(eq(runs.id, seed.id));
    const graph = await executableGraph(goal.senderoVersionId, home, false), step = graph.steps[0]!;
    for (const id of insertionOrder) {
      await db.insert(runs).values({ ...seed, id, status: 'failed', maxAttempts: 5, createdAt: '2000-01-01T00:00:00.000Z' });
      for (const attemptNumber of [2, 1]) await createRunAttempt({ home, runId: id, attemptNumber, agentId: step.agentId, transitionId: step.id, executionObjective: `${id} attempt ${attemptNumber}`, harness: 'custom-tool', status: 'failed' });
    }
    const snapshot = async () => ({
      runs: await db.select().from(runs).orderBy(asc(runs.id)),
      attempts: await db.select().from(runAttempts).orderBy(asc(runAttempts.id)),
      events: await db.select().from(events).orderBy(asc(events.id)),
    });
    const before = await snapshot();
    await expect(scopedApi({ inspect: () => showRunState(goal.id, home) }, 'other-context').inspect()).rejects.toMatchObject({ code: 'NOT_FOUND' });
    const inspected = await showRunState(goal.id, home);
    expect(await snapshot()).toEqual(before);
    expect(inspected.attempts.map(attempt => attempt.attemptNumber)).toEqual([1, 2]);
    expect(inspected.attempts.every(attempt => attempt.runId === inspected.run.id)).toBe(true);
    const recovered = await cursor(goal.id, home);
    expect(recovered.latestRunId).toBe('tie-z');
    expect(inspected.run.id).toBe(recovered.latestRunId);
    expect((await latestRunForGoal(goal.id, home))?.id ?? null).toBe(recovered.latestRunId);
    expect((await showRunState(goal.id, home)).attempts.map(attempt => attempt.id)).toEqual(inspected.attempts.map(attempt => attempt.id));
    expect((await snapshot()).attempts).toEqual(before.attempts);
  });
}

test('latest run inspection prioritizes timestamps over IDs and returns an empty goal history', async () => {
  const home = await initLegacyHome(), project = await createProjectFixture(home);
  const goal = await createGoal({ home, projectId: project.id, title: 'Empty then dated history' });
  expect(await latestRunForGoal(goal.id, home)).toBeNull();
  expect(await showRunState(goal.id, home)).toMatchObject({ run: null, attempts: [] });
  await expect(showRunState('missing-goal', home)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  const db = openRuntimeDb(home), seed = (await createRunRecord(goal, home))!;
  await db.delete(runs).where(eq(runs.id, seed.id));
  for (const [id, createdAt] of [['old-z', '2000-01-01T00:00:00.000Z'], ['new-a', '2000-01-02T00:00:00.000Z']]) {
    await db.insert(runs).values({ ...seed, id: id!, createdAt: createdAt!, status: 'failed' });
  }
  expect((await latestRunForGoal(goal.id, home))?.id).toBe('new-a');
  expect((await showRunState(goal.id, home)).run.id).toBe('new-a');
  expect(await db.select().from(runs)).toHaveLength(2);
});
