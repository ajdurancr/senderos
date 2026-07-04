import { describe, expect, test } from 'bun:test';
import { approveFeature, createFeature, getFeature } from '../index';
import { cancelRun, listRuns, listSessions, startSupervision } from './index';
import { createProjectFixture, initHome } from '../../../../tests/helpers/runtime';

describe('runtime sendero supervisor operations', () => {
  function setupStartedRun(home: string) {
    const project = createProjectFixture(home);
    const feature = approveFeature(createFeature({ home, projectId: project.id, title: 'Run target', gherkinText: 'Feature: Run target' }).id, home)!;
    return { feature, started: startSupervision(feature.id, home) as any };
  }

  test('listRuns returns created runs', () => {
    const home = initHome();
    const { started } = setupStartedRun(home);
    expect(listRuns(home).map((x: any) => x.id)).toContain(started.run.id);
  });

  test('listSessions returns created sessions', () => {
    const home = initHome();
    const { started } = setupStartedRun(home);
    expect(listSessions(home).map((x: any) => x.id)).toContain(started.session.id);
  });

  test('cancelRun marks the run canceled and cancels the feature', () => {
    const home = initHome();
    const { feature, started } = setupStartedRun(home);
    expect((cancelRun(started.run.id, home) as any).status).toBe('canceled');
    expect(getFeature(feature.id, home)?.status).toBe('canceled');
  });
});
