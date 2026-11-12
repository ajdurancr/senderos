import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, expect, it } from 'vitest';
import { missionControlFixture as fixture } from '../../../test-support/mission-control-fixture';
import { CommandPalette } from './command-palette';

afterEach(cleanup);
const owned = {
  ...fixture,
  executionContexts: [...fixture.executionContexts, { ...fixture.executionContexts[0]!, id: 'context-2', name: 'Context Two' }],
  projects: [...fixture.projects, { ...fixture.projects[0]!, id: 'project-2', executionContextId: 'context-2', name: 'Project Two' }],
  goals: [...fixture.goals, { ...fixture.goals[0]!, id: 'goal-2', projectId: 'project-2' }],
  runs: [...fixture.runs, { ...fixture.runs[0]!, id: 'run-2', goalId: 'goal-2' }],
  attempts: [...fixture.attempts, { ...fixture.attempts[0]!, id: 'attempt-2', runId: 'run-2' }],
};
function show(missing = false) {
  const data = missing ? { ...owned, projects: [], executionContexts: [], runs: [] } : owned;
  render(<RouterProvider router={createMemoryRouter([{ path: '*', element: <CommandPalette data={data} /> }])} />);
  fireEvent.click(screen.getByRole('button', { name: 'Search or run a command' }));
}
it('distinguishes duplicate goal titles by accessible owning context and project without changing destinations', () => {
  show();
  fireEvent.change(screen.getByRole('textbox', { name: 'Search commands' }), { target: { value: 'Ship feature' } });
  for (const index of [1, 2]) {
    const row = screen.getByRole('link', { name: `Ship feature · Goal · ${owned.goals[index - 1]!.status} · Context ${index === 1 ? 'One' : 'Two'} · Project ${index === 1 ? 'One' : 'Two'}` });
    expect(row.getAttribute('href')).toBe(`/projects/project-${index}/canvas/goals/goal-${index}`);
  }
});
it('attributes attempts through their own run and goal and preserves status and destination', () => {
  show();
  fireEvent.change(screen.getByRole('textbox', { name: 'Search commands' }), { target: { value: 'Attempt' } });
  for (const index of [1, 2]) {
    const attempt = owned.attempts[index - 1]!;
    const row = screen.getByRole('link', { name: `Attempt ${attempt.id} · ${attempt.harness} · ${attempt.status} · Context ${index === 1 ? 'One' : 'Two'} · Project ${index === 1 ? 'One' : 'Two'}` });
    expect(row.getAttribute('href')).toBe(`/projects/project-${index}/runs/attempts/${attempt.id}`);
  }
});
it('reports missing ownership explicitly while retaining existing orphan attempt navigation', () => {
  show(true);
  fireEvent.change(screen.getByRole('textbox', { name: 'Search commands' }), { target: { value: 'Attempt' } });
  for (const attempt of owned.attempts) {
    const row = screen.getByRole('link', { name: `Attempt ${attempt.id} · ${attempt.harness} · ${attempt.status} · Unknown context · Unknown project` });
    expect(row.getAttribute('href')).toBe(`/runs/attempts/${attempt.id}`);
  }
});
it('does not supply ownership or entities from outside the loaded scope', () => {
  const data = { ...owned, goals: [owned.goals[1]!], attempts: [], runs: [] };
  render(<RouterProvider router={createMemoryRouter([{ path: '*', element: <CommandPalette data={data} projectId="project-2" /> }])} />);
  fireEvent.click(screen.getByRole('button', { name: 'Search or run a command' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Search commands' }), { target: { value: 'Ship feature' } });
  expect(screen.getAllByRole('link')).toHaveLength(1);
  expect(screen.getByRole('link').textContent).toContain('Context Two · Project Two');
  expect(screen.getByRole('link').getAttribute('href')).toBe('/projects/project-2/canvas/goals/goal-2');
});
