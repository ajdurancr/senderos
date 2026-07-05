import { describe, expect, test } from 'bun:test';
import { approveFeature, createFeature, getFeature } from '../index';
import { orchestrateSupervisions, showSupervision, startSupervision, advanceSupervision, resumeSession } from './index';
import { createProjectFixture, initHome } from '../../../../tests/helpers/runtime';

describe('runtime sendero supervisor operations', () => {
  function setupFeature(home: string) {
    const project = createProjectFixture(home);
    return approveFeature(createFeature({ home, projectId: project.id, title: 'Operations target', gherkinText: 'Feature: Operations target' }).id, home)!;
  }

  test('startSupervision throws for missing features', () => {
    const home = initHome();
    expect(() => startSupervision('feature-missing', home)).toThrow();
  });

  test('startSupervision rejects features that are not dispatchable yet', () => {
    const home = initHome();
    const project = createProjectFixture(home);
    expect(() => startSupervision(createFeature({ home, projectId: project.id, title: 'Not ready', gherkinText: 'Feature: Not ready' }).id, home)).toThrow();
  });

  test('showSupervision returns the current run snapshot after dispatch', () => {
    const home = initHome();
    const feature = setupFeature(home);
    const started: any = startSupervision(feature.id, home);
    const shown = showSupervision(feature.id, home) as any;
    expect(shown.currentRun.id).toBe(started.run.id);
    expect(shown.currentRunExecution.runId).toBe(started.run.id);
  });

  test('resumeSession returns resume metadata', () => {
    const home = initHome();
    const feature = setupFeature(home);
    const started: any = startSupervision(feature.id, home);
    expect(resumeSession(started.session.id, home).resumeCommand).toContain(started.session.id);
  });

  test('resumeSession throws for missing sessions', () => {
    const home = initHome();
    expect(() => resumeSession('session-missing', home)).toThrow();
  });

  test('advanceSupervision advances the feature phase', () => {
    const home = initHome();
    const feature = setupFeature(home);
    startSupervision(feature.id, home);
    advanceSupervision(feature.id, home);
    expect(getFeature(feature.id, home)?.senderoStep).toBe('review');
  });

  test('orchestrateSupervisions starts idle active features', () => {
    const home = initHome();
    const feature = setupFeature(home);
    const result: any = orchestrateSupervisions(home);
    expect(result.scanned).toBeGreaterThan(0);
    expect(result.results.some((item: any) => item.featureId === feature.id && item.action === 'started')).toBe(true);
  });

  test('orchestrateSupervisions no-ops when an agent session is still active', () => {
    const home = initHome();
    const feature = setupFeature(home);
    const started: any = startSupervision(feature.id, home);
    const result: any = orchestrateSupervisions(home);
    expect(result.results.some((item: any) => item.featureId === feature.id && item.action === 'noop_running' && item.runId === started.run.id)).toBe(true);
  });
});
