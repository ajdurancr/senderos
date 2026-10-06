import { expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { createGoal, activateGoal, dispatchRun, claimAttempt, heartbeatAttempt, updateRunAttempt, explainGoal, getGoal, cancelGoal, setRetryBudget, draftSendero, publishSendero, createSenderos, recordAttemptEvidence, reviewRunAttempt } from '../index';
import { initHome, createProjectFixture } from '../test-support/runtime';
import { openRuntimeDb, atomic } from '../db/client';
import { attemptClaims, runs, senderoEdges, goalExecutions } from '../db/schema';
import { updateSenderoEdge } from '../internal/senderos/update-edge';

async function setup() {
  const home = await initHome(); const project = await createProjectFixture(home);
  const goal = await createGoal({ home, projectId: project.id, title: 'Hardened lifecycle' });
  await activateGoal(goal.id, home);
  return { home, goal, project };
}
test('full route completes the goal, hands results forward, and replays dispatch without duplicating', async () => {
  const { home, goal } = await setup(); let count = 0;
  while ((await explainGoal(goal.id, home)).state === 'ready') {
    const input = { goalId: goal.id, requestId: `step-${count}` };
    const run = await dispatchRun(input, home);
    expect(await dispatchRun(input, home)).toEqual(run);
    await expect(dispatchRun({ ...input, workingPath: '/different' }, home)).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    await expect(dispatchRun({ goalId: goal.id }, home)).rejects.toMatchObject({ code: 'NOT_READY' });
    const claim = await claimAttempt({ attemptId: run.attemptId, ownerId: 'host-A' }, home);
    if (count) expect(claim.packet.previous.result.step).toBe(count - 1);
    await updateRunAttempt(run.attemptId, { status: 'succeeded', token: claim.token, result: { step: count } }, home);
    await updateRunAttempt(run.attemptId, { status: 'succeeded', token: claim.token, result: { step: count } }, home);
    count++;
  }
  expect(count).toBe(5);
  expect((await getGoal(goal.id, home))?.status).toBe('completed');
  await expect(activateGoal(goal.id, home)).rejects.toMatchObject({ code: 'TERMINAL_GOAL' });
});
test('expired leases require explicit reclaim and fence the previous host', async () => {
  const { home, goal } = await setup();
  const run = await dispatchRun({ goalId: goal.id }, home);
  const first = await claimAttempt({ attemptId: run.attemptId, ownerId: 'A' }, home);
  await expect(claimAttempt({ attemptId: run.attemptId, ownerId: 'B' }, home)).rejects.toMatchObject({ code: 'ALREADY_CLAIMED' });
  await openRuntimeDb(home).update(attemptClaims).set({ leaseExpiresAt: '2000-01-01T00:00:00.000Z' }).where(eq(attemptClaims.attemptId, run.attemptId));
  expect((await explainGoal(goal.id, home)).reason).toBe('lease_expired');
  await expect(claimAttempt({ attemptId: run.attemptId, ownerId: 'B' }, home)).rejects.toMatchObject({ code: 'RECLAIM_REQUIRED' });
  const second = await claimAttempt({ attemptId: run.attemptId, ownerId: 'B', reclaim: true }, home);
  await expect(updateRunAttempt(run.attemptId, { status: 'succeeded', token: first.token }, home)).rejects.toMatchObject({ code: 'STALE_OWNER' });
  expect((await heartbeatAttempt({ attemptId: run.attemptId, token: second.token }, home)).cancellationRequested).toBe(false);
  await cancelGoal(goal.id, home);
  expect((await heartbeatAttempt({ attemptId: run.attemptId, token: second.token }, home)).cancellationRequested).toBe(true);
  await expect(updateRunAttempt(run.attemptId, { status: 'succeeded', token: second.token }, home)).rejects.toMatchObject({ code: 'CANCELLATION_REQUESTED' });
  await updateRunAttempt(run.attemptId, { status: 'canceled', token: second.token }, home);
  expect((await getGoal(goal.id, home))?.status).toBe('canceled');
});
test('retry budget applies across runs, recovery clears failure, and stale plans cannot dispatch', async () => {
  const { home, goal } = await setup();
  const initial = await explainGoal(goal.id, home);
  for (let i = 0; i < 3; i++) {
    const run = await dispatchRun({ goalId: goal.id }, home);
    await updateRunAttempt(run.attemptId, { status: 'failed' }, home);
  }
  expect((await explainGoal(goal.id, home)).reason).toBe('retry_limit_reached');
  await setRetryBudget(goal.id, 4, home);
  await expect(dispatchRun({ goalId: goal.id, expectedRevision: initial.revision }, home)).rejects.toMatchObject({ code: 'STALE_PLAN' });
  const run = await dispatchRun({ goalId: goal.id }, home);
  await updateRunAttempt(run.attemptId, { status: 'succeeded' }, home);
  expect((await getGoal(goal.id, home))?.status).toBe('active');
  expect((await explainGoal(goal.id, home)).transitionId).not.toBe(initial.transitionId);
});
test('published versions remain unchanged and approval/evidence gates hold execution', async () => {
  const { home, goal, project } = await setup();
  const draft = (await draftSendero('software-delivery', home))!;
  const first = draft.edges.find(e => draft.nodes.find(n => n.id === e.sourceNodeId)?.kind === 'agent')!;
  await updateSenderoEdge({ home, id: first.id, completion: { requireReview: true, evidenceKinds: ['test'] } });
  await publishSendero('software-delivery', home);
  expect((await getGoal(goal.id, home))?.senderoVersionId).toBe(goal.senderoVersionId);
  await expect(updateSenderoEdge({ home, id: first.id, name: 'mutation' })).rejects.toMatchObject({ code: 'IMMUTABLE_VERSION' });
  const gated = await createGoal({ home, projectId: project.id, title: 'Gated goal' });
  await activateGoal(gated.id, home);
  const run = await dispatchRun({ goalId: gated.id }, home);
  expect((await updateRunAttempt(run.attemptId, { status: 'succeeded' }, home))?.status).toBe('paused');
  await recordAttemptEvidence({ home, attemptId: run.attemptId, kind: 'test', label: 'Suite passed' });
  expect((await explainGoal(gated.id, home)).state).toBe('blocked');
  await reviewRunAttempt({ home, attemptId: run.attemptId, status: 'approved', reviewer: 'Reviewer' });
  expect((await explainGoal(gated.id, home)).state).toBe('ready');
});
test('rollback leaves no partial state and scoped API cannot mutate another context', async () => {
  const { home, goal } = await setup();
  await expect(atomic(home, async () => {
    await dispatchRun({ goalId: goal.id }, home);
    throw new Error('injected interruption');
  })).rejects.toThrow('injected interruption');
  expect(await openRuntimeDb(home).select().from(runs)).toHaveLength(0);
  expect((await explainGoal(goal.id, home)).state).toBe('ready');
  const other = createSenderos({ home, executionContextId: 'another-context' });
  await expect(other.commands.goals.cancel(goal.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  await expect(other.commands.goals.update({ id: goal.id, title: 'wrong' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
});
test('unsupported graph publication rolls back without changing the active version', async () => {
  const { home } = await setup();
  const draft = (await draftSendero('software-delivery', home))!;
  const edge = draft.edges[1]!;
  await openRuntimeDb(home).insert(senderoEdges).values({ ...edge, id: 'duplicate-route' });
  await expect(publishSendero('software-delivery', home)).rejects.toMatchObject({ code: 'UNSUPPORTED_WORKFLOW' });
  expect((await draftSendero('software-delivery', home))?.version.status).toBe('draft');
});

test('competing dispatches cannot create two active runs', async () => {
  const { home, goal } = await setup();
  const results = await Promise.allSettled([
    dispatchRun({ goalId: goal.id, requestId: 'host-A' }, home),
    dispatchRun({ goalId: goal.id, requestId: 'host-B' }, home),
  ]);
  expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
  expect(await openRuntimeDb(home).select().from(runs)).toHaveLength(1);
}, 30_000);
