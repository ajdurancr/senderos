import { expect, test } from 'bun:test';
import { and, asc, eq } from 'drizzle-orm';
import { strictHostFixture } from '../test-support/host-runtime';
import { atomic } from '../db/client';
import { activations, attemptClaims, events, goalExecutions, runAttempts, runs } from '../db/schema';
import { createSenderos } from '../index';
import { cursor, setRetryBudget } from './state';

async function legacy(f: Awaited<ReturnType<typeof strictHostFixture>>) {
  await f.db.delete(activations).where(eq(activations.goalId, f.goal.id));
  await f.db.delete(goalExecutions).where(eq(goalExecutions.goalId, f.goal.id));
  await f.db.update(runs).set({ activationId: null }).where(eq(runs.goalId, f.goal.id));
}
async function history(f: Awaited<ReturnType<typeof strictHostFixture>>) {
  return {
    runs: (await f.db.select().from(runs).orderBy(asc(runs.id))).map(({ activationId, ...row }) => row),
    attempts: await f.db.select().from(runAttempts).orderBy(asc(runAttempts.id)),
    claims: await f.db.select().from(attemptClaims).orderBy(asc(attemptClaims.attemptId)),
    events: await f.db.select().from(events).orderBy(asc(events.id)),
  };
}
function edit(goalId: string, id: string, payloadJson: string, createdAt = '2026-01-02T00:00:00.000Z') {
  return { id, entityType: 'goal', entityId: goalId, eventType: 'goal.retry-budget-updated', payloadJson, createdAt };
}
for (const limit of [1, 8]) test(`legacy recovery retains saved retry limit ${limit} rather than the earlier reservation limit`, async () => {
  const f = await strictHostFixture();
  await setRetryBudget(f.goal.id, limit, f.home);
  await legacy(f);
  const before = await history(f);
  await expect(createSenderos({ home: f.home, executionContextId: 'foreign' }).commands.goals.explain(f.goal.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  expect(await f.db.select().from(goalExecutions)).toHaveLength(0);
  const recovered = await atomic(f.home, () => cursor(f.goal.id, f.home));
  expect(recovered.maxAttempts).toBe(limit);
  expect((await f.db.select().from(activations))[0]?.maxAttempts).toBe(limit);
  expect(recovered.attemptsUsed).toBe(1);
  expect(await atomic(f.home, () => cursor(f.goal.id, f.home))).toEqual(recovered);
  expect(await history(f)).toEqual(before);
});
test('legacy recovery selects the latest scoped retry edit and ignores older malformed records', async () => {
  const f = await strictHostFixture(); await legacy(f);
  await f.db.insert(events).values([
    edit(f.goal.id, 'z-old', 'invalid', '2026-01-01T00:00:00.000Z'),
    edit(f.goal.id, 'a-new', '{"maxAttempts":7}'),
    edit('another-goal', 'foreign', '{"maxAttempts":99}', '2099-01-01'),
    { ...edit(f.goal.id, 'wrong-type', '{"maxAttempts":99}', '2099-01-01'), entityType: 'project' },
  ]);
  const before = await history(f);
  expect((await atomic(f.home, () => cursor(f.goal.id, f.home))).maxAttempts).toBe(7);
  expect(await history(f)).toEqual(before);
});
test('equivalent latest retry edits agree even when timestamps tie', async () => {
  const f = await strictHostFixture(); await legacy(f);
  await f.db.insert(events).values(['a', 'z'].map(id => edit(f.goal.id, id, '{"maxAttempts":6}')));
  expect((await atomic(f.home, () => cursor(f.goal.id, f.home))).maxAttempts).toBe(6);
});
for (const payload of ['invalid', 'null', '{"maxAttempts":"8"}', '{"maxAttempts":0}', '{"maxAttempts":101}', '{"maxAttempts":1.5}']) test(`invalid legacy retry policy blocks atomically: ${payload}`, async () => {
  const f = await strictHostFixture(); await legacy(f);
  await f.db.insert(events).values(edit(f.goal.id, 'bad', payload));
  const before = await history(f);
  await expect(atomic(f.home, () => cursor(f.goal.id, f.home))).rejects.toMatchObject({ code: 'INCONSISTENT_HISTORY' });
  expect(await f.db.select().from(goalExecutions)).toHaveLength(0);
  expect(await f.db.select().from(activations)).toHaveLength(0);
  expect(await history(f)).toEqual(before);
});
test('conflicting tied retry edits require reconciliation rather than random ID ordering', async () => {
  const f = await strictHostFixture(); await legacy(f);
  await f.db.insert(events).values([4, 8].map((maxAttempts, i) => edit(f.goal.id, `tied-${i}`, JSON.stringify({ maxAttempts }))));
  const before = await history(f);
  await expect(atomic(f.home, () => cursor(f.goal.id, f.home))).rejects.toMatchObject({ code: 'INCONSISTENT_HISTORY' });
  expect(await f.db.select().from(goalExecutions)).toHaveLength(0);
  expect(await f.db.select().from(activations)).toHaveLength(0);
  expect(await history(f)).toEqual(before);
});
test('legacy history without retry edits retains its recorded reservation budget', async () => {
  const f = await strictHostFixture(); await legacy(f);
  expect((await atomic(f.home, () => cursor(f.goal.id, f.home))).maxAttempts).toBe(3);
  expect(await f.db.select().from(events).where(and(eq(events.entityId, f.goal.id), eq(events.eventType, 'goal.retry-budget-updated')))).toHaveLength(0);
});
