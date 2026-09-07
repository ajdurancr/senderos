import { expect, test } from 'bun:test';
import {
  activateGoal,
  createGoal,
  getGoal,
  listGoals,
  updateGoal,
} from './index';
import { createProjectFixture, initHome } from '../../test-support/runtime';

test('goal service persists, updates, activates, and lists goals', async () => {
  const home = await initHome();
  const project = await createProjectFixture(home);
  const goal = await createGoal({
    home,
    projectId: project.id,
    title: 'Improve search',
    kind: 'feature',
  });
  expect(await listGoals(home)).toHaveLength(1);
  expect(
    (await updateGoal({
      home,
      id: goal.id,
      specText: 'Search ranks relevant results.',
    }))?.specText,
  ).toContain('ranks');
  expect((await activateGoal(goal.id, home))?.status).toBe('active');
  expect((await getGoal(goal.id, home))?.id).toBe(goal.id);
});
