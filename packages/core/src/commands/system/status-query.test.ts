import { expect, spyOn, test } from 'bun:test';
import type { InStatement, ResultSet } from '@libsql/client';
import { eq } from 'drizzle-orm';
import { atomic, openRuntimeDb } from '../../db/client';
import { attemptClaims, goals, projects, runAttempts, runs } from '../../db/schema';
import { strictHostFixture } from '../../test-support/host-runtime';
import { createProjectFixture } from '../../test-support/runtime';
import { grantHostWorkspace } from '../../lifecycle/host-registry';
import { listProjects } from '../projects/list';
import { listGoals } from '../goals/list';
import { listRuns } from '../runs/list';
import { listRunAttempts } from '../attempts/list';
import { status, statusFromRecords } from './status';

test('context status projects only summary fields while retaining all ordered IDs and lifecycle classifications', async () => {
  const { home, project, goal, runId, attemptId } = await strictHostFixture();
  const db = openRuntimeDb(home);
  const other = await createProjectFixture(home, { name: 'Hidden context', executionContextId: 'hidden' });
  const run = (await listRuns(home))[0]!;
  const attempt = (await listRunAttempts(runId, home))[0]!;
  const goalStatuses = ['draft', 'active', 'paused', 'blocked', 'failed', 'completed', 'canceled'];
  const runStatuses = ['queued', 'preparing', 'executing', 'validating', 'repairing', 'merging', 'updating_pr', 'cleaning_up', 'succeeded', 'failed', 'canceled'];
  const attemptStatuses = ['queued', 'running', 'paused', 'succeeded', 'failed', 'canceled'];
  const payload = 'isolated-large-payload '.repeat(500);
  // Reverse insertion order: status must preserve creation ordering, not insertion order.
  for (const i of Array.from({ length: 30 }, (_, i) => i).reverse()) {
    const createdAt = new Date(Date.UTC(2000, 0, i + 1)).toISOString();
    await db.insert(goals).values({ ...goal, id: `summary-goal-${i}`, status: goalStatuses[i % goalStatuses.length]!, specText: payload, createdAt });
    await db.insert(runs).values({ ...run, id: `summary-run-${i}`, goalId: `summary-goal-${i}`, status: runStatuses[i % runStatuses.length]!, createdAt });
    await db.insert(runAttempts).values({ ...attempt, id: `summary-attempt-${i}`, runId: `summary-run-${i}`, status: attemptStatuses[i % attemptStatuses.length]!, resultJson: JSON.stringify({ payload }), createdAt });
  }
  await db.insert(goals).values({ ...goal, id: 'hidden-goal', projectId: other.id, specText: payload });
  await db.insert(runs).values({ ...run, id: 'hidden-run', goalId: 'hidden-goal' });
  await db.insert(runAttempts).values({ ...attempt, id: 'hidden-attempt', runId: 'hidden-run' });
  await db.update(projects).set({ status: 'archived' }).where(eq(projects.id, project.id));
  await db.update(goals).set({ status: 'failed' }).where(eq(goals.id, goal.id));
  await db.update(runs).set({ status: 'failed' }).where(eq(runs.id, runId));
  await db.update(runAttempts).set({ status: 'failed' }).where(eq(runAttempts.id, attemptId));
  const expected = statusFromRecords(await listProjects(home, project.executionContextId), await listGoals(home, project.executionContextId), await listRuns(home, project.executionContextId), await listRunAttempts(undefined, home, project.executionContextId));
  expect(expected.projects).toEqual({ total: 1, unhealthy: 1 });
  expect(expected.activeGoalIds.at(-1)).toBe(goal.id);
  expect(expected.runningRunIds[0]).toBe('summary-run-0');
  expect(expected.activeAttemptIds[0]).toBe('summary-attempt-0');
  // Inspect actual driver results, not just the final summary or SQL text.
  await atomic(home, async () => {
    const client = openRuntimeDb(home).$client;
    const execute = client.execute.bind(client) as (statement: InStatement) => Promise<ResultSet>;
    const columns = new Set<string>();
    let rowBytes = 0;
    const spy = spyOn(client, 'execute').mockImplementation(async (...args) => {
      const result = await execute(args[0]);
      for (const column of result.columns) columns.add(column);
      rowBytes += Buffer.byteLength(JSON.stringify(result.rows));
      return result;
    });
    try {
      expect(await status(home, project.executionContextId)).toEqual(expected);
      expect(spy).toHaveBeenCalledTimes(4);
      expect([...columns].sort()).toEqual(['id', 'status']);
      expect(rowBytes).toBeLessThan(20_000);
    } finally { spy.mockRestore(); }
  });
  expect(await status(home, 'missing-context')).toEqual(statusFromRecords([], [], [], []));
  expect(await status(home)).toEqual(statusFromRecords(await listProjects(home), await listGoals(home), await listRuns(home), await listRunAttempts(undefined, home)));
});

test('context status preserves granted and revoked owned sessions without widening project visibility', async () => {
  const { home, project, runId, attemptId, hostApi } = await strictHostFixture(true);
  const assertParity = async () => {
    const expected = statusFromRecords(await listProjects(home, 'remote'), await listGoals(home, 'remote'), await listRuns(home, 'remote'), await listRunAttempts(undefined, home, 'remote'));
    expect(await status(home, 'remote')).toEqual(expected);
    return expected;
  };
  expect(await assertParity()).toMatchObject({ projects: { total: 0, unhealthy: 0 }, activeGoalIds: [], runningRunIds: [], activeAttemptIds: [attemptId] });
  await grantHostWorkspace({ hostId: 'host-a', projectId: project.id, workspaceRef: 'repo', revoke: true }, home);
  expect((await assertParity()).activeAttemptIds).toEqual([]);
  await grantHostWorkspace({ hostId: 'host-a', projectId: project.id, workspaceRef: 'repo' }, home);
  await hostApi.workspace();
  const claim = await hostApi.claim();
  await hostApi.start(claim.token);
  await grantHostWorkspace({ hostId: 'host-a', projectId: project.id, workspaceRef: 'repo', revoke: true }, home);
  expect((await assertParity()).activeAttemptIds).toEqual([attemptId]);
  const db = openRuntimeDb(home);
  await db.update(runAttempts).set({ runId: 'missing-parent' }).where(eq(runAttempts.id, attemptId));
  expect((await assertParity()).activeAttemptIds).toEqual([]);
  expect((await status(home)).activeAttemptIds).toContain(attemptId);
  await db.update(runAttempts).set({ runId }).where(eq(runAttempts.id, attemptId));
  await db.delete(attemptClaims).where(eq(attemptClaims.attemptId, attemptId));
  expect((await assertParity()).activeAttemptIds).toEqual([]);
});
