import { cleanup, render, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, expect, it } from 'vitest';
import { missionControlFixture as fixture } from '../../../test-support/mission-control-fixture';
import { AttentionView } from './workspace-views';

afterEach(cleanup);
const owned = {
  ...fixture,
  executionContexts: [...fixture.executionContexts, { ...fixture.executionContexts[0]!, id: 'context-2', name: 'Context Two' }],
  projects: [...fixture.projects, { ...fixture.projects[0]!, id: 'project-2', executionContextId: 'context-2', name: 'Project Two' }],
  goals: [...fixture.goals, { ...fixture.goals[0]!, id: 'goal-2', projectId: 'project-2' }],
  runs: [...fixture.runs, { ...fixture.runs[0]!, id: 'run-2', goalId: 'goal-2' }],
};
const attempts = [fixture.attempts[0]!, { ...fixture.attempts[0]!, id: 'attempt-2', runId: 'run-2' }];
const queue = {
  ...fixture.queue,
  reviews: attempts.map(attempt => ({ ...fixture.queue.reviews[0]!, attempt })),
  failedAttempts: attempts,
  staleAttempts: attempts,
  dispatchable: [fixture.queue.dispatchable[0]!, { ...fixture.queue.dispatchable[0]!, activationId: 'activation-2', goalId: 'goal-2' }],
};
function show(filter: string, missing = false) {
  const data = missing ? { ...owned, queue, runs: [], goals: [], projects: [], executionContexts: [] } : { ...owned, queue };
  render(<RouterProvider router={createMemoryRouter([{ path: '*', element: <AttentionView data={data} filter={filter} /> }], { initialEntries: [`/now?filter=${filter}`] })} />);
}
it.each(['review', 'failed', 'stale', 'dispatchable'])('attributes duplicate %s rows through their own relationships', filter => {
  show(filter);
  const rows = document.querySelectorAll('.attention-list > a');
  expect(rows).toHaveLength(2);
  for (const [index, row] of [...rows].entries()) {
    expect(row.textContent).toContain(index ? 'Context Two · Project Two' : 'Context One · Project One');
    expect(within(row as HTMLElement).getByRole('heading').textContent).toBe(filter === 'stale' ? 'Deliver' : 'Ship feature');
    expect(row.getAttribute('href')).toBe(filter === 'dispatchable' ? `/projects/project-${index + 1}/canvas/goals/goal-${index + 1}?plan=true` : `/projects/project-${index + 1}/runs/attempts/attempt-${index + 1}`);
    expect(row.textContent).toContain(({ review: 'pending review', failed: 'failed', stale: 'stale', dispatchable: 'ready' })[filter]);
    if (filter === 'stale') expect(row.textContent).toContain('Goal: Ship feature');
  }
});
it.each(['review', 'failed', 'stale', 'dispatchable'])('keeps missing %s ownership explicit without inventing a destination', filter => {
  show(filter, true);
  const rows = document.querySelectorAll('.attention-list > article');
  expect(rows).toHaveLength(2);
  for (const row of rows) expect(row.textContent).toContain('Unknown context · Unknown project');
  expect(document.querySelectorAll('.attention-list > a')).toHaveLength(0);
});
