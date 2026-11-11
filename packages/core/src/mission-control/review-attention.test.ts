import { expect, test } from 'bun:test';
import { asc } from 'drizzle-orm';
import { createSenderos, createAgent, newSendero, publishSendero } from '../index';
import { createProjectFixture, initHome } from '../test-support/runtime';
import { startTestWorker } from '../test-support/worker';
import { openRuntimeDb } from '../db/client';
import { events, runAttempts } from '../db/schema';

async function fixture() {
  const home = await initHome(), api = createSenderos({ home }), project = await createProjectFixture(home);
  const agent = await createAgent({ home, slug: 'review-worker', name: 'Review worker', instructions: 'Isolated review fixture.' });
  await newSendero({ home, slug: 'review-attention', name: 'Review attention', nodes: [
    { key: 'start', kind: 'start', label: 'Start' },
    { key: 'work', kind: 'agent', label: 'Work', agentId: agent.id, executionObjective: 'Review isolated work' },
    { key: 'end', kind: 'end', label: 'End' },
  ], edges: [{ source: 'start', target: 'work' }, { source: 'work', target: 'end' }] });
  const graph = (await publishSendero('review-attention', home))!;
  const goal = await api.commands.goals.create({ projectId: project.id, title: 'Pending review history', senderoVersionId: graph.version.id });
  await api.commands.goals.activate(goal.id);
  const dispatch = () => api.commands.runs.dispatch({ goalId: goal.id });
  const reservation = await dispatch();
  await api.commands.attempts.recordEvidence({ attemptId: reservation.attemptId, kind: 'manual', label: 'Preserved review evidence' });
  const db = openRuntimeDb(home), snapshot = async () => ({
    attempts: await db.select().from(runAttempts).orderBy(asc(runAttempts.id)),
    events: await db.select().from(events).orderBy(asc(events.id)),
  });
  return { home, api, project, goal, reservation, dispatch, snapshot };
}

for (const outcome of ['canceled', 'failed', 'succeeded'] as const) test(`${outcome} reviews leave actionable attention while their exact history remains`, async () => {
  const f = await fixture(), attemptId = f.reservation.attemptId;
  const initial = await f.api.missionControl.overview();
  expect(initial.queue.reviews.map(item => item.attempt.id)).toEqual([attemptId]);
  const pending = initial.attempts.find(item => item.id === attemptId)!.statusSnapshotJson;
  if (outcome === 'canceled') await f.api.commands.goals.cancel(f.goal.id);
  else {
    const claim = await startTestWorker(f.home, f.project.id, attemptId);
    await f.api.commands.attempts.update(attemptId, { token: claim.token, status: outcome });
  }
  const before = await f.snapshot(), overview = await f.api.missionControl.overview();
  expect(overview.attempts.find(item => item.id === attemptId)!.status).toBe(outcome);
  const historical = JSON.parse(overview.attempts.find(item => item.id === attemptId)!.statusSnapshotJson);
  expect(historical.review).toEqual(JSON.parse(pending).review);
  expect(historical.evidence).toEqual(JSON.parse(pending).evidence);
  await expect(f.api.commands.attempts.review({ attemptId, status: 'approved', reviewer: 'fixture-operator' })).rejects.toMatchObject({ code: 'TERMINAL_ATTEMPT' });
  expect(await f.snapshot()).toEqual(before);
  expect(overview.queue.reviews).toEqual([]);
  expect((await f.api.missionControl.overview({ projectId: f.project.id })).queue.reviews).toEqual([]);
  if (outcome === 'failed') {
    const retry = await f.dispatch();
    await f.api.commands.attempts.recordEvidence({ attemptId: retry.attemptId, kind: 'manual', label: 'Retry evidence' });
    const retried = await f.api.missionControl.overview();
    expect(retried.queue.reviews.map(item => item.attempt.id)).toEqual([retry.attemptId]);
    expect(retried.attempts).toHaveLength(2);
    expect(retried.attempts.find(item => item.id === retry.attemptId)?.retryFromAttemptId).toBe(attemptId);
  }
});

test('nonterminal pending attention remains scoped and read-only', async () => {
  const f = await fixture(), before = await f.snapshot();
  const overview = await f.api.missionControl.overview({ projectId: f.project.id });
  expect(overview.queue.reviews.map(item => item.attempt.id)).toEqual([f.reservation.attemptId]);
  expect(await f.snapshot()).toEqual(before);
  const other = await createProjectFixture(f.home, { name: 'Other review project' });
  expect((await f.api.missionControl.overview({ projectId: other.id })).queue.reviews).toEqual([]);
  expect((await createSenderos({ home: f.home, executionContextId: 'outside-context' }).missionControl.overview()).queue.reviews).toEqual([]);
  await f.api.commands.attempts.review({ attemptId: f.reservation.attemptId, status: 'approved', reviewer: 'fixture-operator' });
  expect((await f.api.missionControl.overview()).queue.reviews).toEqual([]);
});
