import { expect, test } from 'bun:test';
import { activateGoal, createGoal } from '../../index';
import { createProjectFixture, initHome } from '../../test-support/runtime';
import { dispatchRun } from '../runs/dispatch';
import { listAgentTransitions } from '../transitions/list';
import { reviewRunAttempt } from './review';

test('reviewRunAttempt records the operator decision', async () => {
  const home = await initHome(); const project = await createProjectFixture(home);
  const goal = (await activateGoal((await createGoal({ home, projectId: project.id, title: 'Review' })).id, home))!;
  const transition = (await listAgentTransitions(home))[0]!;
  const dispatched = await dispatchRun({ goalId: goal.id, transitionId: transition.id, agentId: transition.sourceAgentId }, home);
  expect(await reviewRunAttempt({ attemptId: dispatched.attemptId, status: 'changes_requested', reviewer: 'Tony', rationale: 'Missing proof.', home })).toMatchObject({ status: 'changes_requested', reviewer: 'Tony' });
});
