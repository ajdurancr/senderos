import { expect, test } from 'bun:test';
import {
  activateGoal,
  createGoal,
  dispatchRun,
  getAttempt,
  listAgentTransitions,
  updateRunAttempt,
} from '../commands';
import { createProjectFixture, initHome } from '../test-support/runtime';

test('a goal moves from approved intent to a persisted execution attempt', async () => {
  const home = await initHome();
  const project = await createProjectFixture(home);
  const goal = (await activateGoal(
    (await createGoal({
      home,
      projectId: project.id,
      title: 'End-to-end goal',
      kind: 'refactor',
      intakeText: 'Simplify the runtime.',
      specText: 'The new model is coherent.',
    })).id,
    home,
  ))!;
  const transition = (await listAgentTransitions(home))[0]!;
  const dispatched = await dispatchRun(
    {
      goalId: goal.id,
      transitionId: transition.id,
      agentId: transition.sourceAgentId,
      workingPath: '/tmp/goal-lifecycle',
    },
    home,
  );
  expect(
    (await updateRunAttempt(
      dispatched.attemptId,
      { status: 'succeeded', result: { validated: true } },
      home,
    ))?.status,
  ).toBe('succeeded');
  expect((await getAttempt(dispatched.attemptId, home))?.workingPath).toBe(
    '/tmp/goal-lifecycle',
  );
}, 15_000);
