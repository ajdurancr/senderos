import { describe, expect, test } from 'bun:test';
import { approveFeature, createFeature, getFeature } from '../runtime';
import { dispatchForPhase, getWorkspace } from './index';
import { createProjectFixture, initHome } from '../../../tests/helpers/runtime';

describe('dispatchForPhase', () => {
  test('allocates workspaces and starts run/session/task', () => {
    const home = initHome();
    const project = createProjectFixture(home);
    const feature = approveFeature(
      createFeature({ home, projectId: project.id, title: 'Dispatch me', gherkinText: 'Feature: Dispatch me' }).id,
      home
    )!;
    const dispatched: any = dispatchForPhase(feature, 'implementation', home);
    expect(dispatched.run.status).toBe('executing');
    expect(dispatched.session.status).toBe('active');
    expect(dispatched.task.status).toBe('running');
    const persistedFeature = getFeature(feature.id, home)!;
    expect((getWorkspace(persistedFeature.currentWorkspaceId!, home) as any).status).toBe('active');
  });
});
