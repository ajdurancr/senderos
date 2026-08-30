import { expect, test } from 'bun:test';
import { handleGoal } from './goal';
import { createProjectFixture, initHome } from '../../../tests/helpers/runtime';

test('goal command manages a goal lifecycle', () => {
  const home = initHome();
  const project = createProjectFixture(home);
  const goal = (handleGoal as any)(
    'create',
    [],
    { 'project-id': project.id, title: 'CLI goal', kind: 'maintenance' },
    home,
  );
  expect(
    (handleGoal as any)('show', ['goal', 'show', goal.id], {}, home).title,
  ).toBe('CLI goal');
  expect(
    (handleGoal as any)('activate', ['goal', 'activate', goal.id], {}, home)
      .status,
  ).toBe('active');
});
