import { expect, test } from 'bun:test';
import { activateGoal, createGoal } from '../../index';
import { dispatchRun } from '../runs/dispatch';
import { listAgentTransitions } from '../transitions/list';
import { getRunAttempt } from './get';
import { listRunAttempts } from './list';
import { updateRunAttempt } from './update';
import { createProjectFixture, initHome } from '../../test-support/runtime';

test('attempt commands read and update a dispatched attempt', () => {
  const home = initHome();
  const project = createProjectFixture(home);
  const goal = activateGoal(
    createGoal({ home, projectId: project.id, title: 'Attempt command' }).id,
    home,
  )!;
  const transition = listAgentTransitions(home)[0]!;
  const dispatched = dispatchRun(
    {
      goalId: goal.id,
      transitionId: transition.id,
      agentId: transition.sourceAgentId,
    },
    home,
  );

  expect(listRunAttempts(dispatched.runId, home)).toHaveLength(1);
  expect(getRunAttempt(dispatched.attemptId, home)?.id).toBe(
    dispatched.attemptId,
  );
  expect(
    updateRunAttempt(dispatched.attemptId, { checkpoint: 'verified' }, home)
      ?.checkpoint,
  ).toBe('verified');
});
