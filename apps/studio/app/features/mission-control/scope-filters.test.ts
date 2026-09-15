import { expect, test } from 'vitest';
import { filterMissionControlData } from './scope-filters';

test('filters Studio records by execution context and project', () => {
  const data: any = {
    executionContexts: [{ id: 'context-a', name: 'A' }, { id: 'context-b', name: 'B' }],
    projects: [
      { id: 'project-a', executionContextId: 'context-a' },
      { id: 'project-b', executionContextId: 'context-b' },
    ],
    goals: [{ id: 'goal-a', projectId: 'project-a' }, { id: 'goal-b', projectId: 'project-b' }],
    runs: [{ id: 'run-a', goalId: 'goal-a' }, { id: 'run-b', goalId: 'goal-b' }],
    attempts: [{ id: 'attempt-a', runId: 'run-a' }, { id: 'attempt-b', runId: 'run-b' }],
    events: [{ id: 'event-a', entityId: 'goal-a' }, { id: 'event-b', entityId: 'goal-b' }],
    queue: {
      activeRuns: [{ id: 'run-a' }, { id: 'run-b' }],
      failedAttempts: [{ id: 'attempt-a' }, { id: 'attempt-b' }],
      staleAttempts: [{ id: 'attempt-a' }, { id: 'attempt-b' }],
      reviews: [{ attempt: { id: 'attempt-a' } }, { attempt: { id: 'attempt-b' } }],
      dispatchable: [{ goalId: 'goal-a' }, { goalId: 'goal-b' }],
    },
  };
  const filtered = filterMissionControlData(data, 'context-a');
  expect(filtered.projects.map((item: any) => item.id)).toEqual(['project-a']);
  expect(filtered.goals.map((item: any) => item.id)).toEqual(['goal-a']);
  expect(filtered.runs.map((item: any) => item.id)).toEqual(['run-a']);
  expect(filtered.attempts.map((item: any) => item.id)).toEqual(['attempt-a']);
  expect(filtered.events.map((item: any) => item.id)).toEqual(['event-a']);
  expect(filtered.queue.activeRuns).toHaveLength(1);
  expect(filtered.queue.failedAttempts).toHaveLength(1);
  expect(filtered.queue.staleAttempts).toHaveLength(1);
  expect(filtered.queue.reviews).toHaveLength(1);
  expect(filtered.queue.dispatchable).toHaveLength(1);
});
