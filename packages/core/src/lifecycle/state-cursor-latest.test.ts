import { expect, spyOn, test } from 'bun:test';
import type { InStatement, ResultSet } from '@libsql/client';
import { asc, eq } from 'drizzle-orm';
import { atomic, openRuntimeDb } from '../db/client';
import { goals, runAttempts, runs } from '../db/schema';
import { createGoal } from '../commands/goals/create';
import { createRunRecord } from '../commands/runs/create';
import { createRunAttempt } from '../commands/attempts/create';
import { listRunAttempts } from '../commands/attempts/list';
import { createProjectFixture, initLegacyHome } from '../test-support/runtime';
import { executableGraph } from './route';
import { cursor } from './state';

for (const outcome of ['failed', 'canceled', 'executing', 'succeeded']) test(`legacy ${outcome} migration reads one latest attempt and preserves complete retry history`, async () => {
  const observations: { attempts: number; rows: number; bytes: number }[] = [];
  for (const total of [1, 50, 200]) {
    const home = await initLegacyHome(), project = await createProjectFixture(home);
    const goal = await createGoal({ home, projectId: project.id, title: 'Retained legacy migration' });
    const db = openRuntimeDb(home), graph = await executableGraph(goal.senderoVersionId, home, false);
    await db.update(goals).set({ status: 'active' }).where(eq(goals.id, goal.id));
    const run = (await createRunRecord(goal, home))!;
    await db.update(runs).set({ status: outcome }).where(eq(runs.id, run.id));
    const step = graph.steps[0]!;
    const selected = await createRunAttempt({ home, runId: run.id, attemptNumber: 1000, agentId: step.agentId, transitionId: step.id, executionObjective: 'Latest numbered retry', harness: 'custom-tool', status: outcome === 'executing' ? 'running' : outcome as 'failed' | 'canceled' | 'succeeded' });
    // These retained rows are fixture data, not lifecycle commands. Seed them in
    // one statement so disk commits do not consume the migration test's budget.
    const retained = Array.from({ length: total - 1 }, (_, index) => {
      const number = index + 1;
      return { ...selected, id: `retained-${number}`, attemptNumber: number, status: 'failed' as const, transitionId: number % 2 ? graph.steps[1]!.id : step.id, retryFromAttemptId: number > 1 ? `retained-${number - 1}` : null, resultJson: JSON.stringify({ synthetic: 'Retained legacy payload '.repeat(500) }), createdAt: '2099-01-01T00:00:00.000Z' };
    });
    if (retained.length) await db.insert(runAttempts).values(retained);
    const before = await db.select().from(runAttempts).orderBy(asc(runAttempts.id));
    const responses: ResultSet[] = [];
    const recovered = await atomic(home, async () => {
      const client = openRuntimeDb(home).$client;
      const execute = client.execute.bind(client) as (statement: InStatement) => Promise<ResultSet>;
      const spy = spyOn(client, 'execute').mockImplementation(async (...args) => {
        const result = await execute(args[0]);
        const sql = typeof args[0] === 'string' ? args[0] : args[0].sql;
        if (/from "run_attempts"/.test(sql) && !/count\(/.test(sql)) responses.push(result);
        return result;
      });
      try { return await cursor(goal.id, home); } finally { spy.mockRestore(); }
    });
    expect(recovered).toMatchObject({ transitionId: outcome === 'succeeded' ? graph.steps[1]!.id : step.id, attemptsUsed: outcome === 'succeeded' ? 0 : 1 + Math.floor((total - 1) / 2), latestRunId: run.id });
    const migrated = await db.select().from(runAttempts).orderBy(asc(runAttempts.id));
    expect(migrated).toEqual(before);
    const inspection = await listRunAttempts(run.id, home);
    expect(inspection).toHaveLength(total);
    expect(inspection.at(-1)!.id).toBe(selected.id);
    if (total > 2) expect(inspection.find(attempt => attempt.id === `retained-${total - 1}`)?.retryFromAttemptId).toBe(`retained-${total - 2}`);
    // Re-reading a migrated cursor is idempotent, including the attempt budget.
    expect(await atomic(home, () => cursor(goal.id, home))).toEqual(recovered);
    const observation = { attempts: total, rows: responses.reduce((sum, result) => sum + result.rows.length, 0), bytes: Buffer.byteLength(JSON.stringify(responses.map(result => result.rows))) };
    observations.push(observation);
    console.info(JSON.stringify({ fixture: 'legacy-cursor-selection', outcome, ...observation, synthetic: true }));
  }
  expect(observations.map(item => item.rows)).toEqual([1, 1, 1]);
  for (const item of observations) expect(item.bytes).toBeLessThan(2_000);
});
