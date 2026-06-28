import { describe, expect, test } from 'bun:test';

import {
  approveFeature,
  cancelFeature,
  createFeature,
  getFeature,
  listFeatures,
  updateFeature,
} from './index';
import { listTasks } from '../loop';
import { initHome } from '../../../tests/helpers/runtime';

describe('feature services', () => {
  test('creates, reads, lists, and updates features with seeded contract tasks', () => {
    const home = initHome();
    const created = createFeature({
      home,
      title: 'Add billing portal',
      problemStatement: 'Users need billing access',
      contractText: 'Given a signed-in user',
      completionCriteria: 'Reachable from settings',
    });

    expect(created.status).toBe('defined');
    expect(created.loopPhase).toBe('idle');
    expect(getFeature(created.id, home)?.title).toBe('Add billing portal');
    expect(listFeatures(home)).toHaveLength(1);

    const tasks = listTasks(created.id, home);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.phase).toBe('contract');
    expect(tasks[0]?.status).toBe('ready');

    const updated = updateFeature({
      home,
      id: created.id,
      title: 'Add self-serve billing portal',
      contractText: 'Updated contract',
    });
    expect(updated?.title).toBe('Add self-serve billing portal');
    expect(updated?.problemStatement).toBe('Users need billing access');
    expect(updated?.completionCriteria).toBe('Reachable from settings');
  });

  test('approves existing features and rejects missing ones on update or approval', () => {
    const home = initHome();
    const created = createFeature({ home, title: 'Approval target' });

    expect(approveFeature(created.id, home)).toMatchObject({
      id: created.id,
      status: 'ready_contract',
      loopPhase: 'contract',
    });

    expect(() => approveFeature('feature-missing', home)).toThrow('Feature not found: feature-missing');
    expect(() =>
      updateFeature({
        home,
        id: 'feature-missing',
        title: 'Missing',
      })
    ).toThrow('Feature not found: feature-missing');
  });

  test('cancels features and non-terminal tasks', () => {
    const home = initHome();
    const created = createFeature({ home, title: 'Cancel target' });

    const canceled = cancelFeature(created.id, home);
    expect(canceled?.status).toBe('canceled');

    const tasks = listTasks(created.id, home);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.status).toBe('canceled');
  });
});
