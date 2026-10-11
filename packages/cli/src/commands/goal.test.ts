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
  expect(await handleGoal('explain', ['goal', 'explain', goal.id], {}, home)).toMatchObject({ state: 'ready' });
  expect(await handleGoal('retry-budget', ['goal', 'retry-budget', goal.id], { 'max-attempts': '4' }, home)).toMatchObject({ state: 'ready' });
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

test('goal CLI accepts user-defined categories for non-software objectives', async () => {
  const { createProject } = await import('@senderos/core');
  const home = await initHome();
  const project = await createProject({ home, name: 'Research' });
  expect(await handleGoal('create', [], { 'project-id': project.id, title: 'Explore sources', kind: 'research' }, home)).toMatchObject({ kind: 'research' });
  expect(await handleGoal('create', [], { 'project-id': project.id, title: 'Plan next steps' }, home)).toMatchObject({ kind: 'task', senderoVersionId: null });
  await expect(handleGoal('create', [], { 'project-id': project.id, title: 'Invalid kind', kind: ' ' }, home)).rejects.toThrow('nonempty');
});
