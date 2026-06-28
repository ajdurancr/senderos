import { describe, expect, test } from 'bun:test';
import { handleSession } from './session';
import { approveFeature, createFeature, startLoop } from '../../services/runtime';
import { createProjectFixture, initHome } from '../../../tests/helpers/runtime';

describe('handleSession', () => {
  test('covers list, show, resume, and default error path', () => {
    const home = initHome();
    const project = createProjectFixture(home);
    const feature = approveFeature(createFeature({ home, projectId: project.id, title: 'Session command target', gherkinText: 'Feature: Session command target' }).id, home)!;
    const started: any = startLoop(feature.id, home);
    expect((handleSession('list', [], home) as any[]).map((x) => x.id)).toContain(started.session.id);
    expect((handleSession('show', ['session', 'show', started.session.id], home) as any).id).toBe(started.session.id);
    expect((handleSession('resume', ['session', 'resume', started.session.id], home) as any).resumeCommand).toContain(started.session.id);
    expect(() => handleSession('wat', [], home)).toThrow('Unknown session action');
  });
});
