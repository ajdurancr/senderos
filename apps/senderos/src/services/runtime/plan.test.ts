import { expect, test } from 'bun:test';
import { createGoal, activateGoal } from './goals';
import { plan } from './plan';
import { createProjectFixture, initHome } from '../../../tests/helpers/runtime';

test('planner skips draft goals and selects active goals', () => {
  const home = initHome();
  const project = createProjectFixture(home);
  createGoal({ home, projectId: project.id, title: 'Draft' });
  const active = activateGoal(
    createGoal({ home, projectId: project.id, title: 'Active' }).id,
    home,
  )!;
  const items = plan({ home });
  expect(items).toHaveLength(1);
  expect(items[0]?.goalId).toBe(active.id);
});
