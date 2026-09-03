import { expect, test } from 'bun:test';
import {
  activateGoal,
  createGoal,
  dispatchRun,
  getAttempt,
  listAgentTransitions,
  updateRunAttempt,
} from '../commands';
import { createProjectFixture, initHome } from '../../tests/helpers/runtime';

test('a goal moves from approved intent to a persisted execution attempt', () => {
  const home = initHome();
  const project = createProjectFixture(home);
  const goal = activateGoal(
    createGoal({
      home,
      projectId: project.id,
      title: 'End-to-end goal',
      kind: 'refactor',
      intakeText: 'Simplify the runtime.',
      specText: 'The new model is coherent.',
    }).id,
    home,
  )!;
  const transition = listAgentTransitions(home)[0]!;
  const dispatched = dispatchRun(
    {
      goalId: goal.id,
      transitionId: transition.id,
      agentId: transition.sourceAgentId,
      workingPath: '/tmp/goal-lifecycle',
    },
    home,
  );
  expect(
    updateRunAttempt(
      dispatched.attemptId,
      { status: 'succeeded', result: { validated: true } },
      home,
    )?.status,
  ).toBe('succeeded');
  expect(getAttempt(dispatched.attemptId, home)?.workingPath).toBe(
    '/tmp/goal-lifecycle',
  );
}, 15_000);
