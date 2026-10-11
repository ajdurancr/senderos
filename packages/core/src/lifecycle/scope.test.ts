import { startTestWorker } from '../test-support/worker';
import { expect, test } from 'bun:test';
import { createSenderos, createGoal, activateGoal, dispatchRun } from '../index';
import { initHome, createProjectFixture } from '../test-support/runtime';
test('context boundaries apply to every execution mutation and host resume', async () => {
  const home = await initHome(); const project = await createProjectFixture(home);
  const goal = await createGoal({ home, projectId: project.id, title: 'Scoped' });
  await activateGoal(goal.id, home); const run = await dispatchRun({ goalId: goal.id }, home);
  const foreign = createSenderos({ home, executionContextId: 'foreign' });
  for (const action of [
    () => foreign.commands.runs.cancel(run.runId),
    () => foreign.commands.attempts.update(run.attemptId, { status: 'failed' }),
    () => foreign.commands.attempts.resume(run.attemptId),
    () => foreign.commands.attempts.recordEvidence({ attemptId: run.attemptId, kind: 'manual', label: 'No' }),
    () => foreign.commands.attempts.review({ attemptId: run.attemptId, status: 'approved', reviewer: 'No' }),
    () => foreign.missionControl.goal({ goalId: goal.id }),
  ]) await expect(action()).rejects.toMatchObject({ code: 'NOT_FOUND' });
  const admin = createSenderos({ home, allExecutionContexts: true });
  await admin.commands.executionContexts.list();
  await admin.commands.senderos.draft('software-delivery');
  await admin.commands.senderos.publish('software-delivery');
  expect((await admin.commands.goals.explain(goal.id)).state).toBe('running');
  await admin.commands.goals.setRetryBudget(goal.id, 4);
  const claim = await startTestWorker(home, project.id, run.attemptId);
  await admin.commands.attempts.heartbeat({ attemptId: run.attemptId, token: claim.token });
  await admin.commands.attempts.abandon({ attemptId: run.attemptId, confirmedStopped: true, reason: 'Stopped' });
});
