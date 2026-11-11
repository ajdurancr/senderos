import { expect, spyOn, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { atomic, openRuntimeDb } from '../../db/client';
import { attemptClaims, runAttempts } from '../../db/schema';
import { strictHostFixture } from '../../test-support/host-runtime';
import { createProjectFixture } from '../../test-support/runtime';
import { createGoal } from '../goals/create';
import { activateGoal } from '../goals/activate';
import { dispatchRun } from '../runs/dispatch';
import { grantHostWorkspace } from '../../lifecycle/host-registry';
import { listRunAttempts } from './list';

test('attempt listing uses one database query while preserving host visibility and safe recovery details', async () => {
  const { home, project, attemptId, runId, hostApi } = await strictHostFixture(true);
  const claim = await hostApi.claim();
  await hostApi.start(claim.token);
  const other = await createProjectFixture(home, { name: 'Unrelated project' });
  for (let i = 0; i < 12; i++) {
    const goal = await createGoal({ home, projectId: other.id, title: `Unrelated goal ${i}` });
    await activateGoal(goal.id, home);
    await dispatchRun({ goalId: goal.id }, home);
  }
  await openRuntimeDb(home).update(attemptClaims).set({ recoveryOutcome: 'unknown', recoveryDetailsJson: JSON.stringify({ note: 'Keep host recovery facts' }) }).where(eq(attemptClaims.attemptId, attemptId));
  const read = async (context?: string, selectedRun?: string, selectedProject?: string) => atomic(home, async () => {
    const db = openRuntimeDb(home);
    const execute = spyOn(db.$client, 'execute');
    try {
      const records = await listRunAttempts(selectedRun, home, context, selectedProject);
      const queries = execute.mock.calls.length;
      console.log(`Attempt-list fixture: context=${context ?? 'all'}, records=${records.length}, database queries=${queries}`);
      expect(queries).toBe(1);
      expect(JSON.stringify(records)).not.toContain(claim.token);
      for (const record of records) {
        expect(record).not.toHaveProperty('token');
        expect(record).not.toHaveProperty('packetJson');
      }
      return records;
    } finally { execute.mockRestore(); }
  });
  expect((await read('remote')).map(attempt => attempt.id)).toEqual([attemptId]);
  expect(await read('unrelated')).toEqual([]);
  expect((await read('remote', undefined, project.id)).map(attempt => attempt.id)).toEqual([attemptId]);
  expect(await read('unrelated', undefined, project.id)).toEqual([]);
  expect(await read('remote', undefined, other.id)).toEqual([]);
  expect(await read(undefined, undefined, 'missing')).toEqual([]);
  expect(await read('remote', 'missing')).toEqual([]);
  await grantHostWorkspace({ hostId: 'host-a', projectId: project.id, workspaceRef: 'repo', revoke: true }, home);
  const assigned = await read('remote', runId, project.id);
  expect(assigned).toHaveLength(1);
  expect(assigned[0]).toMatchObject({ id: attemptId, ownerId: 'host-a', recoveryOutcome: 'unknown', recoveryDetails: { note: 'Keep host recovery facts' } });
  expect(await read(project.executionContextId)).toHaveLength(13);
  expect(await read()).toHaveLength(13);
  await openRuntimeDb(home).update(runAttempts).set({ runId: 'missing-parent' }).where(eq(runAttempts.id, attemptId));
  expect(await read('remote')).toEqual([]);
  expect(await read(project.executionContextId, 'missing-parent')).toEqual([]);
  expect(await read(undefined, 'missing-parent')).toHaveLength(1);
  await openRuntimeDb(home).update(runAttempts).set({ runId }).where(eq(runAttempts.id, attemptId));
  // No-claim rows remain inspectable and preserve the established defaults.
  await openRuntimeDb(home).delete(attemptClaims).where(eq(attemptClaims.attemptId, attemptId));
  expect((await read(project.executionContextId, runId))[0]).toMatchObject({ ownerId: null, protocolVersion: 1, recoveryDetails: {} });
  expect(await read('remote', runId)).toEqual([]);
  const original = (await openRuntimeDb(home).select().from(runAttempts).where(eq(runAttempts.id, attemptId)))[0]!;
  const earlier = `${attemptId}-ordering-fixture`;
  await openRuntimeDb(home).insert(runAttempts).values({ ...original, id: earlier, attemptNumber: 2, createdAt: '2000-01-01T00:00:00.000Z' });
  expect((await read(undefined, runId)).map(attempt => attempt.id)).toEqual([attemptId, earlier]);
  expect((await read())[0]?.id).toBe(earlier);
  expect((await read(undefined, undefined, project.id)).map(attempt => attempt.id)).toEqual([earlier, attemptId]);
});
