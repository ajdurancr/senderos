import { expect, test } from 'bun:test';
import { handleGoal } from './goal';
import {
  createProjectFixture,
  initHome,
} from '../../../core/src/test-support/runtime';

test('goal command manages a goal lifecycle', async () => {
  const home = await initHome();
  const project = await createProjectFixture(home);
  const goal = await (handleGoal as any)(
    'create',
    [],
    { 'project-id': project.id, title: 'CLI goal', kind: 'maintenance' },
    home,
  );
  expect(
    (await (handleGoal as any)('show', ['goal', 'show', goal.id], {}, home)).title,
  ).toBe('CLI goal');
  expect(
    (await (handleGoal as any)('activate', ['goal', 'activate', goal.id], {}, home))
      .status,
  ).toBe('active');
});
