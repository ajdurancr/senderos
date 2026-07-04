import { describe, expect, test } from 'bun:test';
import { approveFeature, createFeature, getFeature } from '../runtime';
import { dispatchForPhase, getWorkspace } from './index';
import { createProjectFixture, initHome } from '../../../tests/helpers/runtime';

describe('dispatchForPhase', () => {
  function setupFeature(home: string) {
    const project = createProjectFixture(home);
    return approveFeature(
      createFeature({ home, projectId: project.id, title: 'Dispatch me', gherkinText: 'Feature: Dispatch me' }).id,
      home
    )!;
  }

  test('creates a run in executing state', () => {
    const home = initHome();
    const feature = setupFeature(home);
    const dispatched: any = dispatchForPhase(feature, 'implementation', home);
    expect(dispatched.run.status).toBe('executing');
  });

  test('creates an active session for the dispatched run', () => {
    const home = initHome();
    const feature = setupFeature(home);
    const dispatched: any = dispatchForPhase(feature, 'implementation', home);
    expect(dispatched.session.status).toBe('active');
  });

  test('creates an run execution for the dispatched phase', () => {
    const home = initHome();
    const feature = setupFeature(home);
    const dispatched: any = dispatchForPhase(feature, 'implementation', home);
    expect(dispatched.runExecution.status).toBe('running');
    expect(dispatched.runExecution.hostEnvironmentSessionId).toBe(dispatched.session.id);
  });

  test('marks the phase task as running', () => {
    const home = initHome();
    const feature = setupFeature(home);
    const dispatched: any = dispatchForPhase(feature, 'implementation', home);
    expect(dispatched.task.status).toBe('running');
  });

  test('allocates an active workspace for implementation', () => {
    const home = initHome();
    const feature = setupFeature(home);
    dispatchForPhase(feature, 'implementation', home);
    const persistedFeature = getFeature(feature.id, home)!;
    expect((getWorkspace(persistedFeature.currentWorkspaceId!, home) as any).status).toBe('active');
  });
});
