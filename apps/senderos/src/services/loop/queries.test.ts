import { describe, expect, test } from 'bun:test';

import { createFeature, getFeature } from '../runtime';
import {
  dispatchForPhase,
  ensurePhaseTask,
  getRun,
  getSession,
  getTask,
  getWorkspace,
  listTasks,
} from './index';
import { initHome } from '../../../tests/helpers/runtime';

describe('loop queries', () => {
  test('reads tasks, runs, sessions, and workspaces', () => {
    const home = initHome();
    const feature = createFeature({ home, title: 'Query target' });
    const task = ensurePhaseTask(feature, 'contract', home);

    expect(getTask(task.id, home)?.id).toBe(task.id);
    expect(listTasks(feature.id, home).length).toBeGreaterThan(0);

    const dispatched = dispatchForPhase(feature, 'contract', home) as any;
    const persistedFeature = getFeature(feature.id, home)!;

    expect(getRun(dispatched.run.id, home)).toBeTruthy();
    expect(getSession(dispatched.session.id, home)).toBeTruthy();
    expect(getWorkspace(persistedFeature.currentWorkspaceId!, home)).toBeTruthy();
  });
});
