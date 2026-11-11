import { expect, test } from 'bun:test';
import { asc, eq } from 'drizzle-orm';
import { openRuntimeDb } from '../../db/client';
import { attemptClaims, goals, runAttempts, runs, senderoVersions } from '../../db/schema';
import { createGoal } from '../goals/create';
import { createRunAttempt } from '../attempts/create';
import { createProjectFixture, initLegacyHome } from '../../test-support/runtime';
import { executableGraph } from '../../lifecycle/route';
import { scopedApi } from '../../lifecycle/scope';
import { createRunRecord } from './create';
import { dispatchRun } from './dispatch';

for (const protocolVersion of [1, 2]) for (const status of ['failed', 'succeeded']) {
  test(`protocol ${protocolVersion} ${status} predecessor uses latest numbered retained attempt`, async () => {
    const home = await initLegacyHome(), project = await createProjectFixture(home);
    const db = openRuntimeDb(home);
    await db.update(senderoVersions).set({ protocolVersion });
    const goal = await createGoal({ home, projectId: project.id, title: 'Retained predecessor' });
    await db.update(goals).set({ status: 'active' }).where(eq(goals.id, goal.id));
    const graph = await executableGraph(goal.senderoVersionId, home, false), step = graph.steps[0]!;
    const run = (await createRunRecord(goal, home))!;
    await db.update(runs).set({ status, maxAttempts: 5 }).where(eq(runs.id, run.id));
    const first = await createRunAttempt({ home, runId: run.id, attemptNumber: 1, agentId: step.agentId, transitionId: step.id, executionObjective: 'Earlier attempt', harness: 'custom-tool', status: 'failed', workingPath: '/fixture/old' });
    const latest = await createRunAttempt({ home, runId: run.id, attemptNumber: 2, agentId: step.agentId, transitionId: step.id, executionObjective: 'Current attempt', harness: 'custom-tool', status: status as 'failed' | 'succeeded', workingPath: '/fixture/latest', retryFromAttemptId: first.id });
    await db.update(runAttempts).set({ resultJson: '{"source":"old"}', statusSnapshotJson: '{"checkpoint":"old"}', createdAt: '2099-01-01T00:00:00.000Z' }).where(eq(runAttempts.id, first.id));
    await db.update(runAttempts).set({ resultJson: '{"source":"latest"}', statusSnapshotJson: '{"checkpoint":"latest"}', createdAt: '2000-01-01T00:00:00.000Z' }).where(eq(runAttempts.id, latest.id));
    const history = await db.select().from(runAttempts).orderBy(asc(runAttempts.id));
    const dispatch = (input: Parameters<typeof dispatchRun>[0]) => dispatchRun(input, home);
    await expect(scopedApi({ dispatch }, 'another-context').dispatch({ goalId: goal.id })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(await db.select().from(runAttempts).orderBy(asc(runAttempts.id))).toEqual(history);
    const request = { goalId: goal.id, previousRunId: run.id, requestId: 'retained-retry' };
    const reservation = await dispatch(request);
    const claim = (await db.select().from(attemptClaims).where(eq(attemptClaims.attemptId, reservation.attemptId)))[0]!;
    const packet = JSON.parse(claim.packetJson);
    expect(packet.previous).toEqual({ attemptId: latest.id, result: { source: 'latest' }, snapshot: { checkpoint: 'latest' }, workingPath: '/fixture/latest' });
    const created = (await db.select().from(runAttempts).where(eq(runAttempts.id, reservation.attemptId)))[0]!;
    expect(created.retryFromAttemptId).toBe(status === 'failed' ? latest.id : null);
    expect(created.workingPath).toBe(protocolVersion === 1 ? '/fixture/latest' : null);
    expect(created.workingPathMode).toBe(protocolVersion === 1 ? 'reused' : null);
    expect(packet.history.map((item: { attemptId: string }) => item.attemptId).sort()).toEqual([first.id, latest.id].sort());
    expect(packet.history.find((item: { attemptId: string }) => item.attemptId === first.id).result).toEqual({ source: 'old' });
    expect(await dispatch(request)).toEqual(reservation);
    expect(await db.select().from(runAttempts).orderBy(asc(runAttempts.id))).toEqual([...history, created].sort((a, b) => a.id.localeCompare(b.id)));
  });
}
