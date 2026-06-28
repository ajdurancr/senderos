import { describe, expect, test } from 'bun:test';
import { createFeature } from '../runtime';
import { ensurePhaseTask, getTask, listTasks, updateTaskStatus } from './index';
import { createProjectFixture, initHome } from '../../../tests/helpers/runtime';

describe('loop task helpers', () => {
  test('creates, reuses, and updates tasks', () => {
    const home = initHome();
    const project = createProjectFixture(home);
    const feature = createFeature({ home, projectId: project.id, title: 'Task plumbing', gherkinText: 'Feature: Task plumbing' });
    const implementationTask = ensurePhaseTask(feature, 'implementation', home);
    expect(ensurePhaseTask(feature, 'implementation', home).id).toBe(implementationTask.id);
    expect(ensurePhaseTask(feature, 'review', home).status).toBe('pending');
    updateTaskStatus(implementationTask.id, 'running', { dispatched: true }, home);
    expect(getTask(implementationTask.id, home)?.status).toBe('running');
    expect(listTasks(feature.id, home)).toHaveLength(2);
  });
});
