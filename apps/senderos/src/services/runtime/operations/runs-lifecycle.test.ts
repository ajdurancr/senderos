import { describe, expect, test } from 'bun:test';
import { approveFeature, createFeature, getFeature } from '../index';
import { showLoop, startLoop, tickLoop, resumeSession } from './index';
import { createProjectFixture, initHome } from '../../../../tests/helpers/runtime';

describe('runtime run operations', () => {
  function setupFeature(home: string) {
    const project = createProjectFixture(home);
    return approveFeature(createFeature({ home, projectId: project.id, title: 'Operations target', gherkinText: 'Feature: Operations target' }).id, home)!;
  }

  test('startLoop throws for missing features', () => {
    const home = initHome();
    expect(() => startLoop('feature-missing', home)).toThrow();
  });

  test('startLoop rejects features that are not dispatchable yet', () => {
    const home = initHome();
    const project = createProjectFixture(home);
    expect(() => startLoop(createFeature({ home, projectId: project.id, title: 'Not ready', gherkinText: 'Feature: Not ready' }).id, home)).toThrow();
  });

  test('showLoop returns the current run snapshot after dispatch', () => {
    const home = initHome();
    const feature = setupFeature(home);
    const started: any = startLoop(feature.id, home);
    const shown = showLoop(feature.id, home) as any;
    expect(shown.currentRun.id).toBe(started.run.id);
    expect(shown.currentRunExecution.runId).toBe(started.run.id);
  });

  test('resumeSession returns resume metadata', () => {
    const home = initHome();
    const feature = setupFeature(home);
    const started: any = startLoop(feature.id, home);
    expect(resumeSession(started.session.id, home).resumeCommand).toContain(started.session.id);
  });

  test('resumeSession throws for missing sessions', () => {
    const home = initHome();
    expect(() => resumeSession('session-missing', home)).toThrow();
  });

  test('tickLoop advances the feature phase', () => {
    const home = initHome();
    const feature = setupFeature(home);
    startLoop(feature.id, home);
    tickLoop(feature.id, home);
    expect(getFeature(feature.id, home)?.runPhase).toBe('review');
  });
});
