import { describe, expect, test } from 'bun:test';
import { approveFeature, createFeature, getFeature } from '../index';
import { showLoop, startLoop, tickLoop, resumeSession } from './index';
import { createProjectFixture, initHome } from '../../../../tests/helpers/runtime';

describe('runtime loop operations', () => {
  test('wraps loop operations and session resume', () => {
    const home = initHome();
    const project = createProjectFixture(home);
    const feature = approveFeature(createFeature({ home, projectId: project.id, title: 'Operations target', gherkinText: 'Feature: Operations target' }).id, home)!;
    expect(() => startLoop('feature-missing', home)).toThrow();
    expect(() => startLoop(createFeature({ home, projectId: project.id, title: 'Not ready', gherkinText: 'Feature: Not ready' }).id, home)).toThrow();
    const started: any = startLoop(feature.id, home);
    const shown = showLoop(feature.id, home) as any;
    expect(shown.currentRun.id).toBe(started.run.id);
    expect(resumeSession(started.session.id, home).resumeCommand).toContain(started.session.id);
    expect(() => resumeSession('session-missing', home)).toThrow();
    tickLoop(feature.id, home);
    expect(getFeature(feature.id, home)?.loopPhase).toBe('review');
  });
});
