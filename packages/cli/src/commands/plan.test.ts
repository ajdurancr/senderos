import { expect, test } from 'bun:test';
import { handlePlan } from './plan';
import { activateGoal, createGoal } from '@senderos/senderos';
import { createProjectFixture, initHome } from '../../../senderos/src/test-support/runtime';

test('plan command returns active goals as dispatchable work', () => {
  const home = initHome();
  const project = createProjectFixture(home);
  const goal = activateGoal(
    createGoal({ home, projectId: project.id, title: 'Plan me' }).id,
    home,
  )!;
  expect(
    (handlePlan({ 'goal-status': 'active' }, home) as any[]).some(
      (item) => item.goalId === goal.id,
    ),
  ).toBe(true);
});
