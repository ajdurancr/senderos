import { describe, expect, test } from 'bun:test';
import { handleSession } from './session';
import { approveFeature, createFeature, startSupervision } from '../../services/runtime';
import { createProjectFixture, initHome } from '../../../tests/helpers/runtime';

describe('session command', () => {
  function setupSession(home: string) {
    const project = createProjectFixture(home);
    const feature = approveFeature(createFeature({ home, projectId: project.id, title: 'Session command target', gherkinText: 'Feature: Session command target' }).id, home)!;
    return startSupervision(feature.id, home) as any;
  }

  test('list returns created sessions', () => {
    const home = initHome();
    const started = setupSession(home);
    expect((handleSession('list', [], home) as any[]).map((x) => x.id)).toContain(started.session.id);
  });

  test('show returns a stored session', () => {
    const home = initHome();
    const started = setupSession(home);
    expect((handleSession('show', ['session', 'show', started.session.id], home) as any).id).toBe(started.session.id);
  });

  test('resume returns resume metadata', () => {
    const home = initHome();
    const started = setupSession(home);
    expect((handleSession('resume', ['session', 'resume', started.session.id], home) as any).resumeCommand).toContain(started.session.id);
  });

  test('unknown subcommands throw', () => {
    const home = initHome();
    expect(() => handleSession('wat', [], home)).toThrow('Unknown session action');
  });
});
