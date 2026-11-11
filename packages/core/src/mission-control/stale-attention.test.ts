import { expect, test } from 'bun:test';
import { asc, eq } from 'drizzle-orm';
import { openRuntimeDb } from '../db/client';
import { attemptClaims, events, runAttempts, runs } from '../db/schema';
import { createSenderos, createAgent, newSendero, publishSendero } from '../index';
import { createProjectFixture, initHome } from '../test-support/runtime';
import { startTestWorker } from '../test-support/worker';

async function fixture() {
  const home = await initHome(), api = createSenderos({ home });
  const project = await createProjectFixture(home);
  const agent = await createAgent({ home, slug: 'stale-worker', name: 'Stale worker', instructions: 'Isolated fixture only.' });
  await newSendero({ home, slug: 'parallel-stale', name: 'Parallel stale attention', nodes: [
    { key: 'start', kind: 'start', label: 'Start' },
    ...['left', 'right'].map(key => ({ key, kind: 'agent' as const, label: key, agentId: agent.id, executionObjective: key })),
    { key: 'end', kind: 'end', label: 'End' },
  ], edges: [['start', 'left'], ['start', 'right'], ['left', 'end'], ['right', 'end']].map(([source, target]) => ({ source, target })) });
  const graph = (await publishSendero('parallel-stale', home))!;
  const goal = await api.commands.goals.create({ projectId: project.id, title: 'Recover both branches', senderoVersionId: graph.version.id });
  await api.commands.goals.activate(goal.id);
  const items = await api.commands.plan(), db = openRuntimeDb(home);
  const start = async (index: number) => {
    const reservation = await api.commands.runs.dispatch({ goalId: goal.id, activationId: items[index]!.activationId });
    const claim = await startTestWorker(home, project.id, reservation.attemptId);
    return { ...reservation, claim };
  };
  const expire = async (attemptId: string) => { await db.update(attemptClaims).set({ leaseExpiresAt: '2000-01-01T00:00:00.000Z' }).where(eq(attemptClaims.attemptId, attemptId)); };
  const snapshot = async () => ({
    runs: await db.select().from(runs).orderBy(asc(runs.id)),
    attempts: await db.select().from(runAttempts).orderBy(asc(runAttempts.id)),
    events: await db.select().from(events).orderBy(asc(events.id)),
  });
  return { home, api, db, project, goal, start, expire, snapshot };
}

for (const sibling of ['expired', 'running', 'ready'] as const) test(`stale attention retains an expired branch beside a ${sibling} sibling`, async () => {
  const f = await fixture(), left = await f.start(0);
  const right = sibling === 'ready' ? null : await f.start(1);
  await f.expire(left.attemptId);
  if (sibling === 'expired') await f.expire(right!.attemptId);
  const before = await f.snapshot(), overview = await f.api.missionControl.overview();
  const expected = [left.attemptId, ...(sibling === 'expired' ? [right!.attemptId] : [])].sort();
  expect(overview.queue.staleAttempts.map(item => item.id).sort()).toEqual(expected);
  expect(overview.decisions[0]!.activations.filter(item => item.reason === 'lease_expired').map(item => item.attemptId).sort()).toEqual(expected);
  expect(new Set(overview.queue.staleAttempts.map(item => item.id)).size).toBe(expected.length);
  expect(overview.attempts).toHaveLength(right ? 2 : 1);
  expect(overview.activations).toHaveLength(2);
  expect(await f.snapshot()).toEqual(before);
  const scoped = await f.api.missionControl.overview({ projectId: f.project.id });
  expect(scoped.queue.staleAttempts).toEqual(overview.queue.staleAttempts);
  const other = await createProjectFixture(f.home, { name: 'Other project' });
  expect((await f.api.missionControl.overview({ projectId: other.id })).queue.staleAttempts).toEqual([]);
  expect((await createSenderos({ home: f.home, executionContextId: 'outside-context' }).missionControl.overview()).queue.staleAttempts).toEqual([]);
});

test('completion and cancellation guidance take precedence over expired leases without dropping history', async () => {
  const f = await fixture(), left = await f.start(0), right = await f.start(1);
  await f.expire(left.attemptId); await f.expire(right.attemptId);
  await f.db.update(runAttempts).set({ status: 'paused', statusSnapshotJson: JSON.stringify({ completionRequested: true }) }).where(eq(runAttempts.id, right.attemptId));
  expect((await f.api.missionControl.overview()).queue.staleAttempts.map(item => item.id)).toEqual([left.attemptId]);
  await f.api.commands.goals.cancel(f.goal.id);
  const canceled = await f.api.missionControl.overview();
  expect(canceled.queue.staleAttempts).toEqual([]);
  expect(canceled.decisions[0]!.activations.every(item => item.reason === 'cancellation_requested')).toBe(true);
  expect(canceled.attempts).toHaveLength(2);
  await f.api.commands.attempts.update(left.attemptId, { token: left.claim.token, status: 'canceled' });
  await f.api.commands.attempts.update(right.attemptId, { token: right.claim.token, status: 'canceled' });
  const settled = await f.api.missionControl.overview();
  expect(settled.queue.staleAttempts).toEqual([]);
  expect(settled.attempts).toHaveLength(2);
});

test('stale attention follows a replacement attempt and preserves the expired predecessor in history', async () => {
  const f = await fixture(), original = await f.start(0);
  await f.expire(original.attemptId);
  await f.api.commands.attempts.reconcile({ attemptId: original.attemptId, token: original.claim.token, ownerId: 'test-worker', outcome: 'missing', details: 'Isolated fixture host confirms missing worker.' });
  await f.api.commands.attempts.abandon({ attemptId: original.attemptId, token: original.claim.token, confirmedStopped: true, reason: 'Fixture host confirmed the worker stopped.' });
  const retry = await f.start(0);
  expect((await f.api.missionControl.overview()).queue.staleAttempts).toEqual([]);
  await f.expire(retry.attemptId);
  const overview = await f.api.missionControl.overview();
  expect(overview.queue.staleAttempts.map(item => item.id)).toEqual([retry.attemptId]);
  expect(overview.attempts).toHaveLength(2);
  expect(overview.attempts.find(item => item.id === retry.attemptId)?.retryFromAttemptId).toBe(original.attemptId);
  expect(overview.attempts.find(item => item.id === original.attemptId)?.status).toBe('failed');
});
