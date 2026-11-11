import { expect, test } from 'bun:test';
import { asc, eq } from 'drizzle-orm';
import { strictHostFixture } from '../test-support/host-runtime';
import { activations, attemptClaims, events, goalExecutions, goals, runAttempts, runs } from '../db/schema';
import { atomic } from '../db/client';
import { cursor, setActivationBudget, setRetryBudget } from '../lifecycle/state';
import { createSenderos } from '../index';
import { updateRunAttempt } from '../commands/attempts/update';
import { cancelGoal } from '../commands/goals/cancel';
async function legacy(f: Awaited<ReturnType<typeof strictHostFixture>>) {
  await f.db.delete(activations).where(eq(activations.goalId, f.goal.id));
  await f.db.delete(goalExecutions).where(eq(goalExecutions.goalId, f.goal.id));
  await f.db.update(runs).set({ activationId: null }).where(eq(runs.goalId, f.goal.id));
}
test('legacy cursor reconstruction retains the recorded operator activation limit', async () => {
  const f = await strictHostFixture();
  await setActivationBudget(f.goal.id, 150, f.home);
  await legacy(f);
  const before = await history(f);
  const foreign = createSenderos({ home: f.home, executionContextId: 'unrelated-legacy-context' });
  await expect(foreign.commands.goals.explain(f.goal.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  expect(await f.db.select().from(goalExecutions)).toHaveLength(0);
  const recovered = await atomic(f.home, () => cursor(f.goal.id, f.home));
  expect(recovered.maxActivations).toBe(150);
  expect(await atomic(f.home, () => cursor(f.goal.id, f.home))).toEqual(recovered);
  expect(await history(f)).toEqual(before);
  expect(await f.db.select().from(activations)).toHaveLength(1);
});
for (const signal of ['both', 'event'] as const) test(`legacy cursor reconstruction retains ${signal} cancellation signals and rejects budget changes`, async () => {
  const f = await strictHostFixture(); const claim = await f.hostApi.claim(); await f.hostApi.start(claim.token);
  await cancelGoal(f.goal.id, f.home);
  await legacy(f);
  if (signal === 'event') await f.db.update(attemptClaims).set({ cancellationRequestedAt: null }).where(eq(attemptClaims.attemptId, f.attemptId));
  const before = await history(f);
  expect((await atomic(f.home, () => cursor(f.goal.id, f.home))).cancellationRequestedAt).toBeTruthy();
  await expect(setRetryBudget(f.goal.id, 8, f.home)).rejects.toMatchObject({ code: 'CANCELLATION_REQUESTED' });
  await expect(setActivationBudget(f.goal.id, 150, f.home)).rejects.toMatchObject({ code: 'CANCELLATION_REQUESTED' });
  expect(await history(f)).toEqual(before);
  await updateRunAttempt(f.attemptId, { token: claim.token, status: 'canceled' }, f.home);
  expect((await f.db.select().from(goals).where(eq(goals.id, f.goal.id)))[0]?.status).toBe('canceled');
  expect((await f.db.select().from(attemptClaims).where(eq(attemptClaims.attemptId, f.attemptId)))[0]?.acknowledgedAt).toBeTruthy();
});

// Migration may attach the retained run to its reconstructed activation, but
// every payload, claim, event and attempt must remain exactly as recorded.
async function history(f: Awaited<ReturnType<typeof strictHostFixture>>) {
  return {
    runs: (await f.db.select().from(runs).orderBy(asc(runs.id))).map(({ activationId, ...row }) => row),
    attempts: await f.db.select().from(runAttempts).orderBy(asc(runAttempts.id)),
    claims: await f.db.select().from(attemptClaims).orderBy(asc(attemptClaims.attemptId)),
    events: await f.db.select().from(events).orderBy(asc(events.id)),
  };
}

test('invalid legacy policy blocks before any reconstructed cursor or activation is persisted', async () => {
  const f = await strictHostFixture();
  await legacy(f);
  await f.db.insert(events).values({ id: 'bad-legacy-policy', entityType: 'goal', entityId: f.goal.id, eventType: 'goal.activation-budget-updated', payloadJson: 'invalid json', createdAt: '2026-01-01T00:00:00.000Z' });
  const before = await history(f);
  await expect(atomic(f.home, () => cursor(f.goal.id, f.home))).rejects.toMatchObject({ code: 'INCONSISTENT_HISTORY' });
  expect(await f.db.select().from(goalExecutions)).toHaveLength(0);
  expect(await f.db.select().from(activations)).toHaveLength(0);
  expect(await history(f)).toEqual(before);
});
