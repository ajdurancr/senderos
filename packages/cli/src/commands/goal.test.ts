import { expect, test } from 'bun:test';
import { handleGoal } from './goal';
import { createGoal } from '@senderos/core';
import {
  createProjectFixture,
  initHome,
} from '../../../core/src/test-support/runtime';

test('goal command manages a goal lifecycle', async () => {
  const home = await initHome();
  const project = await createProjectFixture(home);
  const goal = await createGoal({ home, projectId: project.id, title: 'CLI goal', kind: 'maintenance' });
  expect(await handleGoal('show', ['goal', 'show', goal.id], {}, home)).toMatchObject({ title: 'CLI goal' });
  expect(await handleGoal('activate', ['goal', 'activate', goal.id], {}, home)).toMatchObject({ status: 'active' });
});

test('goal command rejects unknown actions and cross-context goal access', async () => {
  const home = await initHome();
  await expect(handleGoal('invalid-action', [], {}, home)).rejects.toThrow(
    'Unknown goal action',
  );
  await expect(
    handleGoal('activate', ['goal', 'activate', 'goal-missing'], {}, home),
  ).rejects.toThrow('Goal not found in the current execution context');
});
