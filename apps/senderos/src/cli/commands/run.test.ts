import { describe, expect, test } from 'bun:test';
import { handleRun } from './run';
import { approveFeature, createFeature } from '../../services/runtime';
import { startLoop } from '../../services/runtime';
import { createProjectFixture, initHome } from '../../../tests/helpers/runtime';

describe('handleRun', () => {
  test('covers list, show, cancel, and default error path', () => {
    const home = initHome();
    const project = createProjectFixture(home);
    const feature = approveFeature(createFeature({ home, projectId: project.id, title: 'Run command target', gherkinText: 'Feature: Run command target' }).id, home)!;
    const started: any = startLoop(feature.id, home);
    expect((handleRun('list', [], home) as any[]).map((x) => x.id)).toContain(started.run.id);
    expect((handleRun('show', ['run', 'show', started.run.id], home) as any).id).toBe(started.run.id);
    expect((handleRun('cancel', ['run', 'cancel', started.run.id], home) as any).status).toBe('canceled');
    expect(() => handleRun('wat', [], home)).toThrow('Unknown run action');
  });
});
