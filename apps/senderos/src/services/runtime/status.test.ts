import { expect, test } from 'bun:test';
import { status } from './status';
import { activateGoal, createGoal } from './goals';
import { createProjectFixture, initHome } from '../../../tests/helpers/runtime';

test('status aggregates current project and goal state', () => {
  const home = initHome();
  const project = createProjectFixture(home);
  const goal = activateGoal(
    createGoal({ home, projectId: project.id, title: 'Visible goal' }).id,
    home,
  )!;
  const result = status(home);
  expect(result.projects.total).toBe(1);
  expect(result.activeGoalIds).toContain(goal.id);
});
