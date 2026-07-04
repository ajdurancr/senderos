import { describe, expect, test } from 'bun:test';
import { approveFeature, createFeature } from '../index';
import { status } from './status';
import { startLoop } from './runs-lifecycle';
import { createProjectFixture, initHome } from '../../../../tests/helpers/runtime';

describe('runtime status operation', () => {
  test('reports current runtime status', () => {
    const home = initHome();
    const project = createProjectFixture(home);
    const feature = approveFeature(createFeature({ home, projectId: project.id, title: 'Status target', gherkinText: 'Feature: Status target' }).id, home)!;
    const started: any = startLoop(feature.id, home);
    const snapshot = status(home);
    expect(snapshot.projects.total).toBe(1);
    expect(snapshot.openFeatures).toBeGreaterThan(0);
    expect(snapshot.activeFeatureIds).toContain(feature.id);
    expect(snapshot.runningRunIds).toContain(started.run.id);
    expect(snapshot.activeSessionIds).toContain(started.session.id);
  });
});
