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
  test('getTask returns a stored task by id', () => {
    const home = initHome();
    const project = createProjectFixture(home);
    const feature = createFeature({ home, projectId: project.id, title: 'Query target', gherkinText: 'Feature: Query target' });
    const task = ensurePhaseTask(feature, 'implementation', home);
    expect(getTask(task.id, home)?.id).toBe(task.id);
  });

  test('listTasks returns tasks for a feature', () => {
    const home = initHome();
    const project = createProjectFixture(home);
    const feature = createFeature({ home, projectId: project.id, title: 'Query target', gherkinText: 'Feature: Query target' });
    ensurePhaseTask(feature, 'implementation', home);
    expect(listTasks(feature.id, home).length).toBeGreaterThan(0);
  });

  test('getRun returns a dispatched run', () => {
    const home = initHome();
    const project = createProjectFixture(home);
    const feature = approveFeature(createFeature({ home, projectId: project.id, title: 'Query target', gherkinText: 'Feature: Query target' }).id, home)!;
    const dispatched = dispatchForPhase(feature, 'implementation', home) as any;
    expect(getRun(dispatched.run.id, home)).toBeTruthy();
  });

  test('getSession returns a dispatched session', () => {
    const home = initHome();
    const project = createProjectFixture(home);
    const feature = approveFeature(createFeature({ home, projectId: project.id, title: 'Query target', gherkinText: 'Feature: Query target' }).id, home)!;
    const dispatched = dispatchForPhase(feature, 'implementation', home) as any;
    expect(getSession(dispatched.session.id, home)).toBeTruthy();
  });

  test('getWorkspace returns an allocated workspace', () => {
    const home = initHome();
    const project = createProjectFixture(home);
    const feature = approveFeature(createFeature({ home, projectId: project.id, title: 'Query target', gherkinText: 'Feature: Query target' }).id, home)!;
    dispatchForPhase(feature, 'implementation', home);
    const persistedFeature = getFeature(feature.id, home)!;
    expect(getWorkspace(persistedFeature.currentWorkspaceId!, home)).toBeTruthy();
  });
});
