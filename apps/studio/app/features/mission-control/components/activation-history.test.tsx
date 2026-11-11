import { afterEach, expect, test } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import type { MissionControlData } from '../server';
import { GoalActivations } from './execution-records';
import { missionControlFixture as base, fixtureAttempt, fixtureTimestamp } from '../../../test-support/mission-control-fixture';
afterEach(cleanup);
const archived: MissionControlData['activations'] = Array.from({ length: 125 }, (_, i) => ({ id: `activation-${String(i).padStart(3, '0')}`, goalId: 'goal-1', nodeId: 'node-agent', status: 'canceled', revision: 1, transitionId: 'edge-1', previousRunId: null, reason: null, attemptsUsed: 1, maxAttempts: 3, inputJson: '{}', updatedAt: fixtureTimestamp, latestRunId: `run-${i}`, parentActivationId: i ? `activation-${String(i - 1).padStart(3, '0')}` : null, scopesJson: '["fork-proof"]', createdAt: fixtureTimestamp }));
const data: MissionControlData = { ...base, activations: archived, runs: archived.map((a, i) => ({ ...base.runs[0]!, id: `run-${i}`, activationId: a.id })), attempts: archived.map((a, i) => ({ ...fixtureAttempt, id: `attempt-${i}`, runId: `run-${i}`, status: 'canceled' })) };
function show(value: MissionControlData = data, attemptId?: string, path = '/projects/project-1/runs?context=context-1&project=project-1') {
  return render(<RouterProvider router={createMemoryRouter([{ path: '*', element: <GoalActivations data={value} goalId="goal-1" attemptId={attemptId} /> }], { initialEntries: [path] })} />);
}
test('bounds settled visit cards without dropping the full goal records', () => {
  const view = show();
  expect(view.container.querySelectorAll('.activation-list > a')).toHaveLength(30);
  expect(data.activations).toHaveLength(125);
});

test('keeps every unresolved branch visible separately from settled history', () => {
  const value = { ...data, activations: [...archived, ...['ready', 'running', 'failed', 'blocked', 'waiting_join'].map((status, i) => ({ ...archived[0]!, id: `open-${i}`, status, latestRunId: null, reason: 'operator_intervention' }))] };
  const view = show(value);
  expect(view.getByLabelText('Current visits').querySelectorAll('article')).toHaveLength(5);
  expect(view.getByLabelText('Settled visits').querySelectorAll('a')).toHaveLength(30);
  expect(view.getByText('Current visits (5)')).toBeTruthy();
  expect(view.getAllByText('operator intervention')).toHaveLength(5);
});
test('deep-links old visits with full-history ordinals, parent, fork and pinned graph facts', () => {
  const view = show(data, 'attempt-2');
  const selected = view.getByLabelText('Settled visits').querySelector('a[aria-current="true"]')!;
  expect(selected.textContent).toContain('visit 3');
  expect(selected.textContent).toContain('Parent activation-001');
  expect(selected.textContent).toContain('Fork generations: fork-proof');
  const target = new URL(selected.getAttribute('href')!, 'http://studio.local');
  expect(target.searchParams.get('visitCursor')).toBeTruthy();
  expect(target.searchParams.get('context')).toBe('context-1');
  const latest = new URL(view.getByRole('link', { name: 'Latest visits' }).getAttribute('href')!, 'http://studio.local');
  expect(latest.searchParams.get('visitHistory')).toBe('latest');
});
test('explicit latest selection retains off-page detail guidance and a route back to its visit', () => {
  const view = show(data, 'attempt-2', '/projects/project-1/runs/attempts/attempt-2?context=context-1&project=project-1&visitHistory=latest');
  expect(view.getByRole('status').textContent).toContain('selected attempt is outside');
  expect(view.getByLabelText('Settled visits').textContent).toContain('visit 125');
  expect(view.getByRole('link', { name: 'Show selected visit' }).getAttribute('href')).not.toContain('visitHistory');
});
test('rejects malformed positions and retains legacy attempts and empty guidance', () => {
  const view = show(data, undefined, '/runs?visitCursor=broken&visitHistory=older');
  expect(view.getByRole('status').textContent).toContain('position is invalid');
  view.unmount();
  const legacy = show({ ...data, activations: [] });
  expect(legacy.getByLabelText('Settled visits').querySelectorAll('a')).toHaveLength(30);
  legacy.unmount();
  expect(show({ ...data, activations: [], attempts: [], runs: [] }).getByText('No activations yet. Start the goal to discover ready work.')).toBeTruthy();
});

test('uses the pinned graph, latest numbered retry and current next action without hiding a failed activation', () => {
  const activation = { ...archived[0]!, status: 'failed' };
  const pinned = { ...base.senderoGraphs[0]!, nodes: base.senderoGraphs[0]!.nodes.map(node => node.id === 'node-agent' ? { ...node, label: 'Pinned worker' } : node) };
  const value: MissionControlData = { ...data, activations: [activation], historyGraphs: [pinned], attempts: [
    { ...fixtureAttempt, id: 'new-retry', runId: activation.latestRunId!, attemptNumber: 2, status: 'running' },
    { ...fixtureAttempt, id: 'older-retry', runId: activation.latestRunId!, attemptNumber: 1, status: 'failed' },
  ], decisions: [{ goalId: 'goal-1', state: 'blocked', reason: 'needs_attention', nextAction: 'retry', activations: [{ goalId: 'goal-1', activationId: activation.id, state: 'blocked', reason: 'lease_expired', nextAction: 'reconcile' }] }] };
  const view = show(value, 'new-retry');
  const selected = view.getByLabelText('Current visits').querySelector('a[aria-current="true"]')!;
  expect(selected.textContent).toContain('Pinned worker · visit 1');
  expect(selected.textContent).toContain('Next: reconcile');
  expect(selected.getAttribute('href')).toContain('new-retry');
  expect(view.getByText('No settled visits yet.')).toBeTruthy();
});
