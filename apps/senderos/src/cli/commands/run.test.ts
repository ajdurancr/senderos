import { describe, expect, test } from 'bun:test';
import { handleRun } from './run';
import { approveFeature, createFeature } from '../../services/runtime';
import { startLoop } from '../../services/runtime';
import { createProjectFixture, initHome } from '../../../tests/helpers/runtime';

describe('run command', () => {
  function setupRun(home: string) {
    const project = createProjectFixture(home);
    const feature = approveFeature(createFeature({ home, projectId: project.id, title: 'Run command target', gherkinText: 'Feature: Run command target' }).id, home)!;
    return startLoop(feature.id, home) as any;
  }

  test('list returns created runs', () => {
    const home = initHome();
    const started = setupRun(home);
    expect((handleRun('list', [], home) as any[]).map((x) => x.id)).toContain(started.run.id);
  });

  test('show returns a stored run', () => {
    const home = initHome();
    const started = setupRun(home);
    expect((handleRun('show', ['run', 'show', started.run.id], home) as any).id).toBe(started.run.id);
  });

  test('cancel marks a run canceled', () => {
    const home = initHome();
    const started = setupRun(home);
    expect((handleRun('cancel', ['run', 'cancel', started.run.id], home) as any).status).toBe('canceled');
  });

  test('unknown subcommands throw', () => {
    const home = initHome();
    expect(() => handleRun('wat', [], home)).toThrow('Unknown run action');
  });
});
