import { describe, expect, test } from 'bun:test';
import { approveFeature, createFeature } from '../index';
import { status } from './status';
import { startLoop } from './loop';
import { initHome } from '../../../../tests/helpers/runtime';

describe('runtime status operation', () => {
  test('reports current runtime status', () => {
    const home = initHome();
    const feature = approveFeature(createFeature({ home, title: 'Status target' }).id, home)!;
    const started: any = startLoop(feature.id, home);
    const snapshot = status(home);
    expect(snapshot.openFeatures).toBeGreaterThan(0);
    expect(snapshot.activeFeatureIds).toContain(feature.id);
    expect(snapshot.runningRunIds).toContain(started.run.id);
    expect(snapshot.activeSessionIds).toContain(started.session.id);
  });
});
