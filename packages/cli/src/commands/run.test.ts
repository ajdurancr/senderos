import { expect, test } from 'bun:test';
import { handleRun } from './run';
import {
  activateGoal,
  createGoal,
  listAgentTransitions,
} from '@senderos/senderos';
import { createProjectFixture, initHome } from '../../../senderos/tests/helpers/runtime';

test('run command dispatches a planned goal', () => {
  const home = initHome();
  const project = createProjectFixture(home);
  const goal = activateGoal(
    createGoal({ home, projectId: project.id, title: 'CLI run' }).id,
    home,
  )!;
  const transition = listAgentTransitions(home)[0]!;
  const dispatched = (handleRun as any)(
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
    (handleRun as any)('show', ['run', 'show', dispatched.runId], {}, home).id,
  ).toBe(dispatched.runId);
});
