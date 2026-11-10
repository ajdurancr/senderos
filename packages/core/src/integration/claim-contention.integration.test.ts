import { expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { strictHostFixture } from '../test-support/host-runtime';
import { missionControlOverview } from '../mission-control/overview';
import { attemptClaims, events, runAttempts } from '../db/schema';

test('competing claims during operator refresh retain one owner and one claim event', async () => {
  const { home, project, attemptId, db, hostApi } = await strictHostFixture();
  // A held reader forces the contenders through commit contention before it
  // releases. Overview also exercises the same planning reads used by Studio.
  const reader = await db.$client.transaction('read');
  await reader.execute('SELECT * FROM attempt_claims');
  const released = new Promise<void>((resolve, reject) => {
    setTimeout(() => { reader.rollback().then(resolve, reject); }, 50);
  });
  const outcomes = await Promise.allSettled([
    hostApi.claim(), hostApi.claim(), missionControlOverview(home, project.executionContextId),
  ]);
  await released;
  expect(outcomes[2]?.status).toBe('fulfilled');
  const claims = outcomes.slice(0, 2);
  expect(claims.filter(result => result.status === 'fulfilled')).toHaveLength(1);
  const loser = claims.find(result => result.status === 'rejected');
  expect(loser && loser.status === 'rejected' ? loser.reason.code : undefined).toBe('ALREADY_CLAIMED');
  expect((await db.select().from(attemptClaims).where(eq(attemptClaims.attemptId, attemptId)))[0]?.ownerId).toBe('host-a');
  expect(await db.select().from(runAttempts).where(eq(runAttempts.id, attemptId))).toHaveLength(1);
  expect((await db.select().from(events)).filter(event => event.eventType === 'attempt.claimed' && event.entityId === attemptId)).toHaveLength(1);
}, 20000);
