import { expect, test } from 'bun:test';
import { and, asc, eq } from 'drizzle-orm';
import { atomic } from '../db/client';
import { activations, attemptClaims, events, goalExecutions, goals, runAttempts } from '../db/schema';
import { strictHostFixture } from '../test-support/host-runtime';
import { cancelGoal } from '../commands/goals/cancel';
import { updateRunAttempt } from '../commands/attempts/update';
import { createSenderos } from '../index';
import { cursor, setActivationBudget, setRetryBudget } from './state';

async function forget(f: Awaited<ReturnType<typeof strictHostFixture>>) {
  await f.db.delete(goalExecutions).where(eq(goalExecutions.goalId, f.goal.id));
}
async function retained(f: Awaited<ReturnType<typeof strictHostFixture>>) {
  return {
    visits: await f.db.select().from(activations).orderBy(asc(activations.id)),
    attempts: await f.db.select().from(runAttempts).orderBy(asc(runAttempts.id)),
    claims: await f.db.select().from(attemptClaims).orderBy(asc(attemptClaims.attemptId)),
    events: await f.db.select().from(events).orderBy(asc(events.id)),
  };
}

test('recovers the operator activation limit from scoped durable policy rather than the pinned default', async () => {
  const f = await strictHostFixture();
  await setActivationBudget(f.goal.id, 150, f.home);
  await setActivationBudget(f.goal.id, 120, f.home);
  const budgetFilter = and(eq(events.entityId, f.goal.id), eq(events.eventType, 'goal.activation-budget-updated'));
  // Authoritative timestamps deliberately disagree with random event IDs.
  const edits = await f.db.select().from(events).where(budgetFilter);
  for (const edit of edits) await f.db.update(events).set({ createdAt: JSON.parse(edit.payloadJson).maxActivations === 120 ? '2026-01-02T00:00:00.000Z' : '2026-01-01T00:00:00.000Z' }).where(eq(events.id, edit.id));
  await f.db.insert(events).values([
    { id: 'foreign-budget', entityType: 'goal', entityId: 'unrelated-goal', eventType: 'goal.activation-budget-updated', payloadJson: '{"maxActivations":900}', createdAt: '2099-01-01' },
    { id: 'wrong-entity-budget', entityType: 'project', entityId: f.goal.id, eventType: 'goal.activation-budget-updated', payloadJson: '{"maxActivations":900}', createdAt: '2099-01-01' },
  ]);
  const before = await retained(f);
  await forget(f);
  const foreign = createSenderos({ home: f.home, executionContextId: 'foreign' });
  await expect(foreign.commands.goals.explain(f.goal.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  expect(await f.db.select().from(goalExecutions)).toHaveLength(0);
  const recovered = await atomic(f.home, () => cursor(f.goal.id, f.home));
  expect(recovered.maxActivations).toBe(120);
  expect(await atomic(f.home, () => cursor(f.goal.id, f.home))).toEqual(recovered);
  expect(await retained(f)).toEqual(before);
});

for (const remaining of ['both', 'claim', 'event'] as const) test(`recovers pending cancellation from ${remaining} signals and still requires host acknowledgement`, async () => {
  const f = await strictHostFixture(), claim = await f.hostApi.claim();
  await f.hostApi.start(claim.token);
  await cancelGoal(f.goal.id, f.home);
  const requestedAt = (await f.db.select().from(attemptClaims).where(eq(attemptClaims.attemptId, f.attemptId)))[0]!.cancellationRequestedAt!;
  if (remaining === 'claim') await f.db.delete(events).where(and(eq(events.entityId, f.goal.id), eq(events.eventType, 'goal.cancellation-requested')));
  if (remaining === 'event') await f.db.update(attemptClaims).set({ cancellationRequestedAt: null }).where(eq(attemptClaims.attemptId, f.attemptId));
  const before = await retained(f);
  await forget(f);
  const recovered = await atomic(f.home, () => cursor(f.goal.id, f.home));
  expect(recovered.cancellationRequestedAt).toBeTruthy();
  if (remaining !== 'event') expect(recovered.cancellationRequestedAt).toBe(requestedAt);
  expect((await f.db.select().from(goals).where(eq(goals.id, f.goal.id)))[0]?.status).toBe('blocked');
  await expect(setRetryBudget(f.goal.id, 8, f.home)).rejects.toMatchObject({ code: 'CANCELLATION_REQUESTED' });
  await expect(setActivationBudget(f.goal.id, 150, f.home)).rejects.toMatchObject({ code: 'CANCELLATION_REQUESTED' });
  expect(await retained(f)).toEqual(before);
  await updateRunAttempt(f.attemptId, { token: claim.token, status: 'canceled' }, f.home);
  expect((await f.db.select().from(goals).where(eq(goals.id, f.goal.id)))[0]?.status).toBe('canceled');
  expect((await f.db.select().from(attemptClaims).where(eq(attemptClaims.attemptId, f.attemptId)))[0]?.acknowledgedAt).toBeTruthy();
});

test('settled cancellation remains canceled after cursor loss even without cancellation events', async () => {
  const f = await strictHostFixture();
  await cancelGoal(f.goal.id, f.home);
  await f.db.delete(events).where(and(eq(events.entityId, f.goal.id), eq(events.eventType, 'goal.canceled')));
  const before = await retained(f);
  await forget(f);
  const recovered = await atomic(f.home, () => cursor(f.goal.id, f.home));
  expect(recovered.cancellationRequestedAt).toBeTruthy();
  expect(recovered.finishedAt).toBeTruthy();
  expect((await f.db.select().from(goals).where(eq(goals.id, f.goal.id)))[0]?.status).toBe('canceled');
  expect(await retained(f)).toEqual(before);
});

for (const payload of ['invalid json', '{"maxActivations":0}', '{"maxActivations":10001}', '{"maxActivations":1.5}', '{"maxActivations":"150"}']) test(`invalid retained activation policy is an explicit atomic blocker: ${payload}`, async () => {
  const f = await strictHostFixture();
  await f.db.insert(events).values({ id: 'invalid-policy', entityType: 'goal', entityId: f.goal.id, eventType: 'goal.activation-budget-updated', payloadJson: payload, createdAt: '2026-01-01T00:00:00.000Z' });
  await forget(f);
  await expect(atomic(f.home, () => cursor(f.goal.id, f.home))).rejects.toMatchObject({ code: 'INCONSISTENT_HISTORY' });
  expect(await f.db.select().from(goalExecutions)).toHaveLength(0);
});

test('conflicting budget edits at a tied timestamp cannot be ordered by random event IDs', async () => {
  const f = await strictHostFixture();
  await f.db.insert(events).values([120, 150].map((maxActivations, i) => ({ id: `tied-budget-${i}`, entityType: 'goal', entityId: f.goal.id, eventType: 'goal.activation-budget-updated', payloadJson: JSON.stringify({ maxActivations }), createdAt: '2026-01-01T00:00:00.000Z' })));
  await forget(f);
  await expect(atomic(f.home, () => cursor(f.goal.id, f.home))).rejects.toMatchObject({ code: 'INCONSISTENT_HISTORY' });
  expect(await f.db.select().from(goalExecutions)).toHaveLength(0);
});

test('equivalent budget edits at the latest timestamp recover the agreed limit', async () => {
  const f = await strictHostFixture();
  await f.db.insert(events).values(['same-a', 'same-b'].map(id => ({ id, entityType: 'goal', entityId: f.goal.id, eventType: 'goal.activation-budget-updated', payloadJson: '{"maxActivations":120}', createdAt: '2026-01-01T00:00:00.000Z' })));
  await forget(f);
  expect((await atomic(f.home, () => cursor(f.goal.id, f.home))).maxActivations).toBe(120);
});

test('invalid retained cancellation time blocks recovery atomically', async () => {
  const f = await strictHostFixture();
  await f.db.insert(events).values({ id: 'invalid-cancellation', entityType: 'goal', entityId: f.goal.id, eventType: 'goal.cancellation-requested', payloadJson: '{}', createdAt: 'invalid time' });
  await forget(f);
  await expect(atomic(f.home, () => cursor(f.goal.id, f.home))).rejects.toMatchObject({ code: 'INCONSISTENT_HISTORY' });
  expect(await f.db.select().from(goalExecutions)).toHaveLength(0);
});

test('a recorded limit below retained usage cannot discard history or authorize a replacement policy', async () => {
  const f = await strictHostFixture();
  const [first] = await f.db.select().from(activations).where(eq(activations.goalId, f.goal.id));
  await f.db.insert(activations).values({ ...first!, id: 'retained-other-visit', status: 'canceled', latestRunId: null, attemptsUsed: 0 });
  await f.db.insert(events).values({ id: 'too-small-budget', entityType: 'goal', entityId: f.goal.id, eventType: 'goal.activation-budget-updated', payloadJson: '{"maxActivations":1}', createdAt: '2026-01-01T00:00:00.000Z' });
  const before = await retained(f);
  await forget(f);
  await expect(atomic(f.home, () => cursor(f.goal.id, f.home))).rejects.toMatchObject({ code: 'INCONSISTENT_HISTORY' });
  expect(await f.db.select().from(goalExecutions)).toHaveLength(0);
  expect(await retained(f)).toEqual(before);
});
