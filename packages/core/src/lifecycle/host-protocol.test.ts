import { expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { enforceStartedAttempt } from './host-protocol';
import { strictHostFixture } from '../test-support/host-runtime';
import { attemptClaims, runAttempts } from '../db/schema';

test('strict protocol requires claim and start and freezes session and host metadata', async () => {
  const { db, attemptId, hostApi } = await strictHostFixture();
  const attempt = (await db.select().from(runAttempts).where(eq(runAttempts.id, attemptId)))[0]!;
  let claim = (await db.select().from(attemptClaims).where(eq(attemptClaims.attemptId, attemptId)))[0]!;
  expect(() => enforceStartedAttempt(attempt, {}, claim)).toThrow('Claim');
  expect(() => enforceStartedAttempt(attempt, { status: 'succeeded' }, undefined)).not.toThrow();
  const owned = await hostApi.claim();
  claim = (await db.select().from(attemptClaims).where(eq(attemptClaims.attemptId, attemptId)))[0]!;
  expect(() => enforceStartedAttempt(attempt, { status: 'succeeded' }, claim)).toThrow('independent');
  expect(() => enforceStartedAttempt(attempt, { status: 'failed' }, claim)).not.toThrow();
  for (const input of [{ externalSessionId: 'inline' }, { workingPath: '/wrong' }, { harness: 'other' }, { hostEnvironmentName: 'other' }]) expect(() => enforceStartedAttempt(attempt, input, claim)).toThrow();
  const started = await hostApi.start(owned.token);
  claim = (await db.select().from(attemptClaims).where(eq(attemptClaims.attemptId, attemptId)))[0]!;
  expect(() => enforceStartedAttempt(started, { status: 'succeeded', externalSessionId: started.externalSessionId, workingPath: started.workingPath, harness: started.harness, hostEnvironmentName: started.hostEnvironmentName }, claim)).not.toThrow();
  expect(() => enforceStartedAttempt(started, {}, claim)).not.toThrow();
});
