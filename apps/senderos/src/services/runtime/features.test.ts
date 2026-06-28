import { describe, expect, test } from 'bun:test';
import { approveFeature, cancelFeature, createFeature, getFeature, listFeatures, updateFeature } from './index';
import { listTasks } from '../loop';
import { createProjectFixture, initHome } from '../../../tests/helpers/runtime';

describe('feature services', () => {
  test('creates, reads, lists, updates, approves and cancels features', () => {
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
    expect(listFeatures(home)).toHaveLength(1);
    expect(listTasks(created.id, home)).toHaveLength(0);
    const updated = updateFeature({ home, id: created.id, title: 'Add self-serve billing portal', gherkinText: 'Feature: Updated contract' });
    expect(updated?.title).toBe('Add self-serve billing portal');
    expect(approveFeature(created.id, home)?.status).toBe('active');
    expect(listTasks(created.id, home)[0]?.phase).toBe('implementation');
    expect(() => approveFeature('feature-missing', home)).toThrow();
    expect(() => updateFeature({ home, id: 'feature-missing', title: 'Missing' })).toThrow();
    expect(cancelFeature(created.id, home)?.status).toBe('canceled');
  });
});
