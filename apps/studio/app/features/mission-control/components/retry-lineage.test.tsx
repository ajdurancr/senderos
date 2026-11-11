import { afterEach, expect, test } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { missionControlFixture as base, fixtureAttempt } from '../../../test-support/mission-control-fixture';
import type { MissionControlData } from '../server';
import { ContextualInspector } from './contextual-inspector';
import { RunsView } from './workspace-views';
afterEach(cleanup);
const retry: MissionControlData['attempts'][number] = { ...fixtureAttempt, id: 'retry', runId: 'retry-run', attemptNumber: 2, status: 'running', retryFromAttemptId: fixtureAttempt.id, statusSnapshotJson: '{}' };
const data: MissionControlData = { ...base, runs: [...base.runs, { ...base.runs[0]!, id: 'retry-run', status: 'executing' }], attempts: [fixtureAttempt, retry], decisions: [{ goalId: 'goal-1', state: 'running', reason: 'work_running', nextAction: 'wait', activations: [{ goalId: 'goal-1', activationId: 'activation-1', attemptId: 'retry', state: 'running', reason: 'host_running', nextAction: 'wait' }] }] };
function show(value = data, id = fixtureAttempt.id, runs = false) {
 return render(<RouterProvider router={createMemoryRouter([{ path: '*', element: runs ? <RunsView data={value} attemptId={id} /> : <ContextualInspector data={value} goalId="goal-1" attemptId={id} /> }], { initialEntries: ['/projects/project-1/runs?context=context-1&project=project-1'] })} />);
}
test('historical selection does not claim the current retry decision belongs to the selected attempt', () => {
 const view = show();
 expect(view.queryByText('Selected activation')).toBeNull();
 expect(view.getByText('Test report')).toBeTruthy();
 expect(view.getByRole('link', { name: 'Retry attempt 2 · running' }).getAttribute('href')).toContain('/attempts/retry');
});
test('both detail surfaces navigate to the exact predecessor while preserving scope', () => {
 for (const runs of [false, true]) {
  const view = show(data, 'retry', runs);
  const link = view.getByRole('link', { name: 'Previous attempt 1 · failed' });
  expect(link.getAttribute('href')).toContain('context=context-1');
  expect(link.getAttribute('href')).toContain('/attempts/attempt-1');
  view.unmount();
 }
});
test('missing, cross-goal and self predecessors never expose another execution', () => {
 for (const previous of ['missing', 'foreign', 'retry']) {
  const value = { ...data, runs: [...data.runs, { ...base.runs[0]!, id: 'foreign-run', goalId: 'foreign-goal' }], attempts: [...data.attempts.filter(a => a.id !== 'retry'), { ...retry, retryFromAttemptId: previous }, { ...fixtureAttempt, id: 'foreign', runId: 'foreign-run' }] };
  const view = show(value, 'retry');
  expect(view.getByText('Previous attempt is unavailable in this execution scope.')).toBeTruthy();
  expect(view.queryByRole('link', { name: /^Previous attempt/ })).toBeNull();
  view.unmount();
 }
});
test('branching successors are all available without following recursive references', () => {
 const view = show({ ...data, attempts: [...data.attempts, { ...retry, id: 'retry-b', attemptNumber: 3 }] });
 expect(view.getByRole('link', { name: 'Retry attempt 2 · running' })).toBeTruthy();
 expect(view.getByRole('link', { name: 'Retry attempt 3 · running' })).toBeTruthy();
});

test('rejects another activation and preserves legacy retry links only within the same step', () => {
 const view = show({ ...data, runs: data.runs.map(run => run.id === 'retry-run' ? { ...run, activationId: 'another-activation' } : run) }, 'retry');
 expect(view.getByText('Previous attempt is unavailable in this execution scope.')).toBeTruthy();
 view.unmount();
 const legacy = { ...data, runs: data.runs.map(run => ({ ...run, activationId: null })) };
 const valid = show(legacy, 'retry');
 expect(valid.getByRole('link', { name: 'Previous attempt 1 · failed' })).toBeTruthy();
 valid.unmount();
 const invalid = show({ ...legacy, attempts: legacy.attempts.map(a => a.id === 'retry' ? { ...a, agentId: 'another-agent' } : a) }, 'retry');
 expect(invalid.getByText('Previous attempt is unavailable in this execution scope.')).toBeTruthy();
});
