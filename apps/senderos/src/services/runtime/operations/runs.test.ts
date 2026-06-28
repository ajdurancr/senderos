import { describe, expect, test } from 'bun:test';
import { approveFeature, createFeature, getFeature } from '../index';
import { cancelRun, listRuns, listSessions } from './index';
import { startLoop } from './loop';
import { createProjectFixture, initHome } from '../../../../tests/helpers/runtime';

describe('runtime run operations', () => {
  test('lists runs/sessions and cancels runs', () => {
    const home = initHome();
    const project = createProjectFixture(home);
    const feature = approveFeature(createFeature({ home, projectId: project.id, title: 'Run target', gherkinText: 'Feature: Run target' }).id, home)!;
    const started: any = startLoop(feature.id, home);
    expect(listRuns(home).map((x: any) => x.id)).toContain(started.run.id);
    expect(listSessions(home).map((x: any) => x.id)).toContain(started.session.id);
    expect((cancelRun(started.run.id, home) as any).status).toBe('canceled');
    expect(getFeature(feature.id, home)?.status).toBe('canceled');
  });
});
