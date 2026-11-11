import { cleanup, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, expect, test } from 'vitest';
import { missionControlFixture as base } from '../../../test-support/mission-control-fixture';
import { goalExecution } from '../model';
import { ContextualInspector } from './contextual-inspector';

afterEach(cleanup);
for (const ids of [['tie-z', 'tie-a'], ['tie-a', 'tie-z']]) test(`tied run inspection selects deterministic latest but retains exact old selection: ${ids.join(', ')}`, () => {
  const data = { ...base, runs: ids.map(id => ({ ...base.runs[0]!, id, createdAt: '2000-01-01T00:00:00.000Z' })), attempts: ids.flatMap(id => [2, 1].map(attemptNumber => ({ ...base.attempts[0]!, id: `${id}-${attemptNumber}`, runId: id, attemptNumber, executionObjective: `${id} objective ${attemptNumber}` }))) };
  const before = JSON.stringify(data);
  const show = (attemptId?: string) => render(<RouterProvider router={createMemoryRouter([{ path: '*', element: <ContextualInspector data={data} goalId={base.goals[0]!.id} attemptId={attemptId} /> }], { initialEntries: ['/canvas'] })} />);
  const view = show();
  expect(screen.getByText('tie-z objective 2')).toBeTruthy();
  expect(goalExecution(data, base.goals[0]!.id).attempts.map(item => item.id)).toEqual(['tie-a-1', 'tie-a-2', 'tie-z-1', 'tie-z-2']);
  view.unmount();
  show('tie-a-1');
  expect(screen.getByText('tie-a objective 1')).toBeTruthy();
  expect(JSON.stringify(data)).toBe(before);
});
