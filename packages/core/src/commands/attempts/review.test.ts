import { expect, test } from 'bun:test';
import { activateGoal, createGoal } from '../../index';
import { createProjectFixture, initHome } from '../../test-support/runtime';
import { dispatchRun } from '../runs/dispatch';
import { listAgentTransitions } from '../transitions/list';
import { reviewRunAttempt } from './review';

test('reviewRunAttempt records the operator decision', () => {
  const home = initHome(); const project = createProjectFixture(home);
  const goal = activateGoal(createGoal({ home, projectId: project.id, title: 'Review' }).id, home)!;
  const transition = listAgentTransitions(home)[0]!;
  const dispatched = dispatchRun({ goalId: goal.id, transitionId: transition.id, agentId: transition.sourceAgentId }, home);
  expect(reviewRunAttempt({ attemptId: dispatched.attemptId, status: 'changes_requested', reviewer: 'Tony', rationale: 'Missing proof.', home })).toMatchObject({ status: 'changes_requested', reviewer: 'Tony' });
});
