import { describe, expect, test } from 'bun:test';
import { approveFeature, cancelFeature, createFeature, getFeature, listFeatures, updateFeature } from './index';
import { listTasks } from '../loop';
import { initHome } from '../../../tests/helpers/runtime';

describe('feature services', () => {
  test('creates, reads, lists, updates, approves and cancels features', () => {
    const home = initHome();
    const created = createFeature({ home, title: 'Add billing portal', problemStatement: 'Users need billing access', contractText: 'Given a signed-in user', completionCriteria: 'Reachable from settings' });
    expect(created.status).toBe('defined');
    expect(getFeature(created.id, home)?.title).toBe('Add billing portal');
    expect(listFeatures(home)).toHaveLength(1);
    expect(listTasks(created.id, home)[0]?.phase).toBe('contract');
    const updated = updateFeature({ home, id: created.id, title: 'Add self-serve billing portal', contractText: 'Updated contract' });
    expect(updated?.title).toBe('Add self-serve billing portal');
    expect(approveFeature(created.id, home)?.status).toBe('ready_contract');
    expect(() => approveFeature('feature-missing', home)).toThrow();
    expect(() => updateFeature({ home, id: 'feature-missing', title: 'Missing' })).toThrow();
    expect(cancelFeature(created.id, home)?.status).toBe('canceled');
  });
});
