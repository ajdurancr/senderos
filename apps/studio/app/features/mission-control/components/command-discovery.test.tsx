import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, expect, it } from 'vitest';
import { missionControlFixture as fixture } from '../../../test-support/mission-control-fixture';
import { CommandPalette } from './command-palette';

afterEach(cleanup);
const goals = Array.from({ length: 10 }, (_, index) => ({ ...fixture.goals[0]!, id: `known-goal-${index}`, title: 'Identical outcome' }));
function show(data = { ...fixture, goals }) {
  render(<RouterProvider router={createMemoryRouter([{ path: '*', element: <CommandPalette data={data} /> }])} />);
  fireEvent.click(screen.getByRole('button', { name: 'Search or run a command' }));
}
function search(value: string) { fireEvent.change(screen.getByRole('textbox', { name: 'Search commands' }), { target: { value } }); }
it('reports the bounded loaded match count without changing result order or cap', () => {
  show(); search('Identical outcome');
  expect(screen.getAllByRole('link')).toHaveLength(9);
  expect(screen.getAllByRole('link').map(link => link.getAttribute('href'))).toEqual(goals.slice(0, 9).map(goal => `/projects/${goal.projectId}/canvas/goals/${goal.id}`));
  expect(screen.getByRole('status').textContent).toContain('Showing 9 of 10 matches in loaded Studio data');
  expect(screen.getByText('Refine by name, context, project, or goal/attempt ID.')).toBeTruthy();
});
it('finds an omitted loaded goal by its case-insensitive ID and preserves its destination', () => {
  show(); search('KNOWN-GOAL-9');
  expect(screen.getAllByRole('link')).toHaveLength(1);
  expect(screen.getByRole('link').getAttribute('href')).toBe(`/projects/${goals[9]!.projectId}/canvas/goals/known-goal-9`);
  expect(screen.getByRole('status').textContent).toContain('Showing 1 of 1 matches in loaded Studio data');
});
it('does not resolve an ID outside the loaded data and describes the limited search scope', () => {
  show({ ...fixture, goals: goals.slice(0, 9) }); search('known-goal-9');
  expect(screen.queryAllByRole('link')).toHaveLength(0);
  expect(screen.getByRole('status').textContent).toContain('Showing 0 of 0 matches in loaded Studio data');
  expect(screen.getByText('Nothing matches in the loaded Studio data.')).toBeTruthy();
  expect(screen.getByText('Searches loaded Studio data only')).toBeTruthy();
});
it('keeps attempt ID lookup and explicit missing-owner labels', () => {
  show({ ...fixture, goals: [], projects: [], executionContexts: [], runs: [] }); search(fixture.attempts[0]!.id.toUpperCase());
  expect(screen.getByRole('link').getAttribute('href')).toBe(`/runs/attempts/${fixture.attempts[0]!.id}`);
  expect(screen.getByRole('link').textContent).toContain('Unknown context · Unknown project');
});
it('handles no loaded entities without suggesting that all stored entities were searched', () => {
  show({ ...fixture, goals: [], attempts: [], projects: [], executionContexts: [] }); search('missing-record');
  expect(screen.queryAllByRole('link')).toHaveLength(0);
  expect(screen.getByText('Nothing matches in the loaded Studio data.')).toBeTruthy();
});
it('refines duplicate names by existing owning context or project without adding unloaded records', () => {
  const data = { ...fixture, executionContexts: [...fixture.executionContexts, { ...fixture.executionContexts[0]!, id: 'other-context', name: 'Second context' }], projects: [...fixture.projects, { ...fixture.projects[0]!, id: 'other-project', executionContextId: 'other-context', name: 'Second project' }], goals: [...goals, { ...goals[0]!, id: 'other-goal', projectId: 'other-project' }] };
  show(data);
  for (const query of ['Second context', 'Second project', 'other-goal']) {
    search(query);
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByRole('link').getAttribute('href')).toBe('/projects/other-project/canvas/goals/other-goal');
  }
});
