import { expect, test } from 'bun:test';
import { handlePlan } from './plan';
import { activateGoal, createGoal } from '@senderos/core';
import {
  createProjectFixture,
  initHome,
} from '../../../core/src/test-support/runtime';

test('plan command returns active goals as dispatchable work', async () => {
  const home = await initHome();
  const project = await createProjectFixture(home);
  const goal = (await activateGoal(
    (await createGoal({ home, projectId: project.id, title: 'Plan me' })).id,
    home,
  ))!;
  expect(
    (await handlePlan({ 'goal-status': 'active' }, home) as any[]).some(
      (item) => item.goalId === goal.id,
    ),
  ).toBe(true);
});
