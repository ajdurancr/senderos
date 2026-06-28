import { describe, expect, test } from 'bun:test';
import { approveFeature, createFeature, getFeature } from '../index';
import { showLoop, startLoop, tickLoop, resumeSession } from './index';
import { initHome } from '../../../../tests/helpers/runtime';

describe('runtime loop operations', () => {
  test('wraps loop operations and session resume', () => {
    const home = initHome();
    const feature = approveFeature(createFeature({ home, title: 'Operations target' }).id, home)!;
    expect(() => startLoop('feature-missing', home)).toThrow();
    expect(() => startLoop(createFeature({ home, title: 'Not ready' }).id, home)).toThrow();
    const started: any = startLoop(feature.id, home);
    const shown = showLoop(feature.id, home) as any;
    expect(shown.currentRun.id).toBe(started.run.id);
    expect(resumeSession(started.session.id, home).resumeCommand).toContain(started.session.id);
    expect(() => resumeSession('session-missing', home)).toThrow();
    tickLoop(feature.id, home);
    expect(getFeature(feature.id, home)?.loopPhase).toBe('implementation');
  });
});
