import { describe, expect, test } from 'bun:test';
import { handleLoop } from './loop';
import { approveFeature, createFeature } from '../../services/runtime';
import { createProjectFixture, initHome } from '../../../tests/helpers/runtime';

describe('loop command', () => {
  function setupFeature(home: string) {
    const project = createProjectFixture(home);
    return approveFeature(
      createFeature({ home, projectId: project.id, title: 'Loop command target', gherkinText: 'Feature: Loop command target' }).id,
      home
    )!;
  }

  test('start dispatches a run', () => {
    const home = initHome();
    const feature = setupFeature(home);
    const started: any = handleLoop('start', ['loop', 'start', feature.id], home);
    expect(started.run).toBeTruthy();
  });

  test('show returns current loop state', () => {
    const home = initHome();
    const feature = setupFeature(home);
    handleLoop('start', ['loop', 'start', feature.id], home);
    const shown: any = handleLoop('show', ['loop', 'show', feature.id], home);
    expect(shown.feature.id).toBe(feature.id);
  });

  test('resume returns the current run wrapper', () => {
    const home = initHome();
    const feature = setupFeature(home);
    handleLoop('start', ['loop', 'start', feature.id], home);
    const resumed: any = handleLoop('resume', ['loop', 'resume', feature.id], home);
    expect(resumed.run).toBeTruthy();
  });

  test('tick advances the loop', () => {
    const home = initHome();
    const feature = setupFeature(home);
    handleLoop('start', ['loop', 'start', feature.id], home);
    const ticked: any = handleLoop('tick', ['loop', 'tick', feature.id], home);
    expect(ticked.feature).toBeTruthy();
  });

  test('unknown subcommands throw', () => {
    const home = initHome();
    expect(() => handleLoop('wat', ['loop', 'wat', 'feature-id'], home)).toThrow('Unknown loop action');
  });
});
