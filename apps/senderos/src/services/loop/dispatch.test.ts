import { describe, expect, test } from 'bun:test';
import { createFeature, getFeature } from '../runtime';
import { dispatchForPhase, getWorkspace } from './index';
import { initHome } from '../../../tests/helpers/runtime';

describe('dispatchForPhase', () => {
  test('allocates workspaces and starts run/session/task', () => {
    const home = initHome();
    const feature = createFeature({ home, title: 'Dispatch me' });
    const dispatched: any = dispatchForPhase(feature, 'contract', home);
    expect(dispatched.run.status).toBe('running');
    expect(dispatched.session.status).toBe('active');
    expect(dispatched.task.status).toBe('running');
    expect((getWorkspace(getFeature(feature.id, home)!.currentWorkspaceId!, home) as any).status).toBe('locked');
  });
});
