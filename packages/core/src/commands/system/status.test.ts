import { expect, test } from 'bun:test';
import { statusFromRecords } from './status';

test('selected-record status retains lifecycle classifications and input ordering', () => {
  expect(statusFromRecords(
    [{ status: 'healthy' }, { status: 'archived' }, { status: 'broken' }],
    [{ id: 'draft', status: 'draft' }, { id: 'canceled', status: 'canceled' }, { id: 'blocked', status: 'blocked' }, { id: 'completed', status: 'completed' }, { id: 'active', status: 'active' }],
    [{ id: 'merging', status: 'merging' }, { id: 'succeeded', status: 'succeeded' }, { id: 'queued', status: 'queued' }, { id: 'failed', status: 'failed' }, { id: 'canceled', status: 'canceled' }],
    [{ id: 'paused', status: 'paused' }, { id: 'failed', status: 'failed' }, { id: 'queued', status: 'queued' }, { id: 'running', status: 'running' }, { id: 'succeeded', status: 'succeeded' }, { id: 'canceled', status: 'canceled' }],
  )).toEqual({
    projects: { total: 3, unhealthy: 2 }, openGoals: 3, activeRuns: 2,
    activeGoalIds: ['draft', 'blocked', 'active'], runningRunIds: ['merging', 'queued'], activeAttemptIds: ['paused', 'queued', 'running'],
  });
  expect(statusFromRecords([], [], [], [])).toEqual({ projects: { total: 0, unhealthy: 0 }, openGoals: 0, activeRuns: 0, activeGoalIds: [], runningRunIds: [], activeAttemptIds: [] });
});
