import { expect, test } from 'bun:test';
import { planFromDecisions } from './plan';
import type { GoalStatus } from '../../shared/types';

type Decision = Parameters<typeof planFromDecisions>[1][number];
function decision(goalId: string, states: Array<'ready' | 'blocked' | 'running'>): Decision {
  return { goalId, state: states[0] ?? 'completed', reason: 'fixture', nextAction: 'fixture', activations: states.map((state, index) => ({
    goalId, activationId: `${goalId}-${index}`, state, reason: 'fixture', nextAction: 'fixture',
    transitionId: `transition-${index}`, agentId: 'worker', revision: index + 1,
    ...(index ? { previousRunId: 'previous-run' } : {}),
  })) };
}

test('snapshot plans preserve goal and activation order, eligibility and retry metadata', () => {
  const statuses: GoalStatus[] = ['draft', 'active', 'failed', 'blocked', 'completed', 'canceled'];
  const goals = statuses.map(status => ({ id: status, status }));
  const decisions = statuses.map(status => decision(status, ['ready', 'blocked', 'ready', 'running'])).reverse();
  const items = planFromDecisions(goals, decisions);
  expect(items.map(item => item.activationId)).toEqual(['active-0', 'active-2', 'failed-0', 'failed-2', 'blocked-0', 'blocked-2']);
  expect(items[0]).toEqual({ goalId: 'active', activationId: 'active-0', transitionId: 'transition-0', agentId: 'worker', previousRunId: null, revision: 1 });
  expect(items[1]).toMatchObject({ previousRunId: 'previous-run', revision: 3 });
  expect(planFromDecisions(goals, decisions, [])).toEqual(items);
  expect(planFromDecisions(goals, decisions, ['draft']).map(item => item.activationId)).toEqual(['draft-0', 'draft-2']);
});

test('snapshot plans do not invent missing or non-ready decisions', () => {
  const goals = [{ id: 'missing', status: 'active' as const }, { id: 'waiting', status: 'blocked' as const }];
  expect(planFromDecisions(goals, [decision('foreign', ['ready']), decision('waiting', ['blocked', 'running'])])).toEqual([]);
  expect(planFromDecisions([], [decision('foreign', ['ready'])])).toEqual([]);
});
