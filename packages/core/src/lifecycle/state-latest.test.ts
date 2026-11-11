import { expect, spyOn, test } from 'bun:test';
import type { InStatement, ResultSet } from '@libsql/client';
import { asc, eq } from 'drizzle-orm';
import { atomic, openRuntimeDb } from '../db/client';
import { runAttempts } from '../db/schema';
import { listRunAttempts } from '../commands/attempts/list';
import { strictHostFixture } from '../test-support/host-runtime';
import { explainGoal } from './state';

test('activation guidance selects the latest numbered attempt while complete inspection retains every retry', async () => {
  const { home, goal, runId, attemptId } = await strictHostFixture();
  const db = openRuntimeDb(home);
  // Retained legacy retries may share a run. The highest number, not creation
  // time or insertion order, owns the current guidance and completion facts.
  await db.update(runAttempts).set({ attemptNumber: 1000, status: 'paused', statusSnapshotJson: JSON.stringify({ completionRequested: true, evidence: [] }) }).where(eq(runAttempts.id, attemptId));
  const selected = (await db.select().from(runAttempts).where(eq(runAttempts.id, attemptId)))[0]!;
  const expected = await explainGoal(goal.id, home);
  expect(expected).toMatchObject({ attemptId, state: 'blocked', reason: 'completion_prerequisites', nextAction: 'review_or_record_evidence' });
  let inserted = 0;
  const observations: { attempts: number; returnedRows: number; rowBytes: number }[] = [];
  for (const total of [1, 50, 200]) {
    while (inserted < total - 1) {
      const number = ++inserted;
      await db.insert(runAttempts).values({ ...selected, id: `old-retry-${number}`, attemptNumber: number, status: 'failed', retryFromAttemptId: number > 1 ? `old-retry-${number - 1}` : null, statusSnapshotJson: '{}', resultJson: JSON.stringify({ syntheticPayload: 'Retained retry payload '.repeat(500) }), createdAt: '2099-01-01T00:00:00.000Z' });
    }
    const before = await db.select().from(runAttempts).orderBy(asc(runAttempts.id));
    const responses: ResultSet[] = [];
    await atomic(home, async () => {
      const client = openRuntimeDb(home).$client;
      const execute = client.execute.bind(client) as (statement: InStatement) => Promise<ResultSet>;
      const spy = spyOn(client, 'execute').mockImplementation(async (...args) => {
        const result = await execute(args[0]);
        const sql = typeof args[0] === 'string' ? args[0] : args[0].sql;
        if (/from "run_attempts"/.test(sql)) responses.push(result);
        return result;
      });
      try { expect(await explainGoal(goal.id, home)).toEqual(expected); } finally { spy.mockRestore(); }
    });
    const observation = { attempts: total, returnedRows: responses.reduce((sum, result) => sum + result.rows.length, 0), rowBytes: Buffer.byteLength(JSON.stringify(responses.map(result => result.rows))) };
    observations.push(observation);
    console.info(JSON.stringify({ fixture: 'retained-retry-guidance', ...observation, synthetic: true }));
    expect(responses).toHaveLength(1);
    const inspection = await listRunAttempts(runId, home);
    expect(inspection).toHaveLength(total);
    expect(inspection.find(attempt => attempt.id === `old-retry-${inserted}`)?.retryFromAttemptId).toBe(inserted > 1 ? `old-retry-${inserted - 1}` : undefined);
    expect(await db.select().from(runAttempts).orderBy(asc(runAttempts.id))).toEqual(before);
  }
  expect(observations.map(item => item.returnedRows)).toEqual([1, 1, 1]);
  for (const item of observations) expect(item.rowBytes).toBeLessThan(2_000);
});
