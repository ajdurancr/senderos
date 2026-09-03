import { expect, test } from 'bun:test';
import {
  activateGoal,
  createGoal,
  getGoal,
  listGoals,
  updateGoal,
} from './index';
import { createProjectFixture, initHome } from '../../test-support/runtime';

test('goal service persists, updates, activates, and lists goals', () => {
  const home = initHome();
  const project = createProjectFixture(home);
  const goal = createGoal({
    home,
    projectId: project.id,
    title: 'Improve search',
    kind: 'feature',
  });
  expect(listGoals(home)).toHaveLength(1);
  expect(
    updateGoal({
      home,
      id: goal.id,
      specText: 'Search ranks relevant results.',
    })?.specText,
  ).toContain('ranks');
  expect(activateGoal(goal.id, home)?.status).toBe('active');
  expect(getGoal(goal.id, home)?.id).toBe(goal.id);
});
