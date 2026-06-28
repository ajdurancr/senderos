import { describe, expect, test } from 'bun:test';
import { createFeature } from '../runtime';
import { ensurePhaseTask, getTask, listTasks, updateTaskStatus } from './index';
import { initHome } from '../../../tests/helpers/runtime';

describe('loop task helpers', () => {
  test('creates, reuses, and updates tasks', () => {
    const home = initHome();
    const feature = createFeature({ home, title: 'Task plumbing' });
    const contractTask = ensurePhaseTask(feature, 'contract', home);
    expect(ensurePhaseTask(feature, 'contract', home).id).toBe(contractTask.id);
    expect(ensurePhaseTask(feature, 'implementation', home).status).toBe('pending');
    updateTaskStatus(contractTask.id, 'running', { dispatched: true }, home);
    expect(getTask(contractTask.id, home)?.status).toBe('running');
    expect(listTasks(feature.id, home)).toHaveLength(2);
  });
});
