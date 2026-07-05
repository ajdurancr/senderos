import { describe, expect, test } from 'bun:test';

import { approveFeature, cancelFeature, createFeature, getFeature, listFeatures, updateFeature } from './index';
import { createProjectFixture, initHome } from '../../../tests/helpers/runtime';

describe('feature services', () => {
  test('creates a feature in awaiting_scenario_approval state', () => {
    const home = initHome();
    const project = createProjectFixture(home);
    const created = createFeature({
      home,
      projectId: project.id,
      title: 'Add billing portal',
      specText: 'Spec: users need billing access',
      sourceRequestText: 'please add billing',
      gherkinText: 'Feature: Billing portal',
      gherkinMeta: { scenarios: ['@s1'] },
    });

    expect(created.status).toBe('awaiting_scenario_approval');
    expect(getFeature(created.id, home)?.title).toBe('Add billing portal');
  });

  test('lists created features', () => {
    const home = initHome();
    const project = createProjectFixture(home);
    createFeature({ home, projectId: project.id, title: 'Feature one', gherkinText: 'Feature: One' });
    expect(listFeatures(home)).toHaveLength(1);
  });

  test('updates feature contract fields while no run is active', () => {
    const home = initHome();
    const project = createProjectFixture(home);
    const created = createFeature({ home, projectId: project.id, title: 'Feature one', gherkinText: 'Feature: One' });

    const updated = updateFeature({
      home,
      id: created.id,
      title: 'Updated feature one',
      gherkinText: 'Feature: Updated One',
    });

    expect(updated?.title).toBe('Updated feature one');
    expect(updated?.gherkinText).toBe('Feature: Updated One');
  });

  test('approve moves a feature into active dispatchable state', () => {
    const home = initHome();
    const project = createProjectFixture(home);
    const created = createFeature({ home, projectId: project.id, title: 'Feature one', gherkinText: 'Feature: One' });

    const approved = approveFeature(created.id, home);
    expect(approved?.status).toBe('active');
    expect(approved?.senderoStep).toBe('idle');
  });

  test('cancel marks the feature canceled', () => {
    const home = initHome();
    const project = createProjectFixture(home);
    const created = createFeature({ home, projectId: project.id, title: 'Feature one', gherkinText: 'Feature: One' });
    expect(cancelFeature(created.id, home)?.status).toBe('canceled');
  });

  test('missing feature operations throw', () => {
    const home = initHome();
    expect(() => approveFeature('feature-missing', home)).toThrow();
    expect(() => updateFeature({ home, id: 'feature-missing', title: 'Missing' })).toThrow();
  });
});
