import { describe, expect, test } from 'bun:test';
import { createFeature } from '../runtime';
import { ensurePhaseTask, getTask, listTasks, updateTaskStatus } from './index';
import { createProjectFixture, initHome } from '../../../tests/helpers/runtime';

describe('run task helpers', () => {
  test('ensurePhaseTask creates a task for a new phase', () => {
    const home = initHome();
    const project = createProjectFixture(home);
    const feature = createFeature({ home, projectId: project.id, title: 'Task plumbing', gherkinText: 'Feature: Task plumbing' });
    expect(ensurePhaseTask(feature, 'implementation', home).phase).toBe('implementation');
  });

  test('ensurePhaseTask reuses an existing task for the same phase', () => {
    const home = initHome();
    const project = createProjectFixture(home);
    const feature = createFeature({ home, projectId: project.id, title: 'Task plumbing', gherkinText: 'Feature: Task plumbing' });
    const first = ensurePhaseTask(feature, 'implementation', home);
    expect(ensurePhaseTask(feature, 'implementation', home).id).toBe(first.id);
  });

  test('updateTaskStatus changes persisted task state', () => {
    const home = initHome();
    const project = createProjectFixture(home);
    const feature = createFeature({ home, projectId: project.id, title: 'Task plumbing', gherkinText: 'Feature: Task plumbing' });
    const task = ensurePhaseTask(feature, 'implementation', home);
    updateTaskStatus(task.id, 'running', { dispatched: true }, home);
    expect(getTask(task.id, home)?.status).toBe('running');
  });

  test('listTasks returns all tasks created for a feature', () => {
    const home = initHome();
    const project = createProjectFixture(home);
    const feature = createFeature({ home, projectId: project.id, title: 'Task plumbing', gherkinText: 'Feature: Task plumbing' });
    ensurePhaseTask(feature, 'implementation', home);
    ensurePhaseTask(feature, 'review', home);
    expect(listTasks(feature.id, home)).toHaveLength(2);
  });
});
