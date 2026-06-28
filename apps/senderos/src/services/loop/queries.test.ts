import { describe, expect, test } from 'bun:test';

import { approveFeature, createFeature, getFeature } from '../runtime';
import {
  dispatchForPhase,
  ensurePhaseTask,
  getRun,
  getSession,
  getTask,
  getWorkspace,
  listTasks,
} from './index';
import { createProjectFixture, initHome } from '../../../tests/helpers/runtime';

describe('loop queries', () => {
  test('reads tasks, runs, sessions, and workspaces', () => {
    const home = initHome();
    const project = createProjectFixture(home);
    const feature = createFeature({ home, projectId: project.id, title: 'Query target', gherkinText: 'Feature: Query target' });
    const task = ensurePhaseTask(feature, 'implementation', home);

    expect(getTask(task.id, home)?.id).toBe(task.id);
    expect(listTasks(feature.id, home).length).toBeGreaterThan(0);

    const approved = approveFeature(feature.id, home)!;
    const dispatched = dispatchForPhase(approved, 'implementation', home) as any;
    const persistedFeature = getFeature(feature.id, home)!;

    expect(getRun(dispatched.run.id, home)).toBeTruthy();
    expect(getSession(dispatched.session.id, home)).toBeTruthy();
    expect(getWorkspace(persistedFeature.currentWorkspaceId!, home)).toBeTruthy();
  });
});
