import { expect, test } from 'bun:test';
import { handleRun } from './run';
import {
  activateGoal,
  createGoal,
  listAgentTransitions,
} from '@senderos/core';
import {
  createProjectFixture,
  initHome,
} from '../../../core/src/test-support/runtime';

test('run command dispatches a planned goal', async () => {
  const home = await initHome();
  const project = await createProjectFixture(home);
  const goal = (await activateGoal(
    (await createGoal({ home, projectId: project.id, title: 'CLI run' })).id,
    home,
  ))!;
  const transition = (await listAgentTransitions(home))[0]!;
  const dispatched = await (handleRun as any)(
    'dispatch',
    [],
    {
      'goal-id': goal.id,
      'transition-id': transition.id,
      'agent-id': transition.sourceAgentId,
    },
    home,
  );
  expect(
    (await (handleRun as any)('show', ['run', 'show', dispatched.runId], {}, home)).id,
  ).toBe(dispatched.runId);
});

test('run command rejects unknown actions and records outside the current context', async () => {
  const home = await initHome();
  await expect((handleRun as any)('wat', [], {}, home)).rejects.toThrow(
    'Unknown run action',
  );
  await expect(
    (handleRun as any)('cancel', ['run', 'cancel', 'run-missing'], {}, home),
  ).rejects.toThrow('Run not found in the current execution context');
  await expect(
    (handleRun as any)('state', ['run', 'state', 'goal-missing'], {}, home),
  ).rejects.toThrow('Goal not found in the current execution context');
});
