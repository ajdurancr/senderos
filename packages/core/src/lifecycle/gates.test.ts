import { startTestWorker } from '../test-support/worker';
import { expect, test } from 'bun:test';
import { initHome, createProjectFixture } from '../test-support/runtime';
import { createGoal, activateGoal, dispatchRun, updateRunAttempt, reviewRunAttempt, getGoal, draftSendero, publishSendero } from '../index';
import { setCompletionPolicy } from './versions';
test('review rejection releases a paused completion as a bounded failure', async () => {
  const home = await initHome(); const project = await createProjectFixture(home);
  await draftSendero('software-delivery', home);
  await setCompletionPolicy({ senderoId: 'software-delivery', agent: 'spec-partner', requireReview: true, evidenceKinds: [] }, home);
  await publishSendero('software-delivery', home);
  const goal = await createGoal({ home, projectId: project.id, title: 'Reject review' });
  await activateGoal(goal.id, home); const run = await dispatchRun({ goalId: goal.id }, home);
  const claim = await startTestWorker(home, project.id, run.attemptId);
  await updateRunAttempt(run.attemptId, { status: 'succeeded', token: claim.token }, home);
  await reviewRunAttempt({ home, attemptId: run.attemptId, status: 'changes_requested', reviewer: 'Reviewer' });
  expect((await getGoal(goal.id, home))?.status).toBe('failed');
});
