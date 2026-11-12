import { cleanup, render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, expect, it } from 'vitest';
import { missionControlFixture as fixture } from '../../../test-support/mission-control-fixture';
import { ReviewsView } from './reviews-view';

afterEach(cleanup);
const data = { ...fixture, attempts: Array.from({ length: 65 }, (_, i) => ({ ...fixture.attempts[0]!, id: `review-${String(i).padStart(3, '0')}`, createdAt: '2026-11-10T12:00:00Z', executionObjective: `Proof ${i}`, statusSnapshotJson: JSON.stringify({ evidence: [{ id: `proof-${i}`, kind: 'manual', label: `Proof ${i}` }], ...(i < 20 ? { review: { status: 'approved' } } : {}) }) })) };
function show(path = '/reviews?context=one&project=two') {
  return render(<RouterProvider router={createMemoryRouter([{ path: '*', element: <ReviewsView data={data} /> }], { initialEntries: [path] })} />);
}
it('bounds tied records with complete counts and scope-preserving cursor links', () => {
  show(); expect(document.querySelectorAll('.review-grid article')).toHaveLength(30);
  expect(screen.getByText(/30 on this page · 65 matching · 65 in this scope/)).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Pending review (45)' })).toBeTruthy();
  const older = new URL(screen.getByRole('link', { name: 'Older reviews' }).getAttribute('href')!, 'http://local');
  expect(older.searchParams.get('context')).toBe('one'); expect(older.searchParams.get('project')).toBe('two');
  expect(JSON.parse(older.searchParams.get('reviewCursor')!).id).toBe('review-035');
});
it('filters before pagination and binds cursors to the status as well as scope', () => {
  show('/reviews?context=one&project=two&reviewStatus=approved');
  expect(document.querySelectorAll('.review-grid article')).toHaveLength(20);
  expect(screen.queryByRole('link', { name: 'Older reviews' })).toBeNull();
  expect(screen.getByRole('link', { name: 'Approved (20)' }).getAttribute('aria-current')).toBe('page');
});
it('recovers invalid cursor and filter without losing records', () => {
  show('/reviews?reviewStatus=invalid&reviewCursor=bad&reviewHistory=older');
  expect(screen.getAllByRole('status').map(item => item.textContent).join(' ')).toContain('filter is invalid');
  expect(screen.getAllByRole('status').map(item => item.textContent).join(' ')).toContain('position is invalid');
  expect(document.querySelectorAll('.review-grid article')).toHaveLength(30);
});
it('offers explicit recovery for a valid empty filter', () => {
  show('/reviews?reviewStatus=rejected');
  expect(screen.getByRole('heading', { name: 'No reviews match this selection' })).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Show all reviews' }).getAttribute('href')).toBe('/reviews#review-history');
});

it('attributes duplicate objectives through their own run, goal, project and context', () => {
  const owned = {
    ...fixture,
    executionContexts: [...fixture.executionContexts, { ...fixture.executionContexts[0]!, id: 'context-2', name: 'Context Two' }],
    projects: [...fixture.projects, { ...fixture.projects[0]!, id: 'project-2', executionContextId: 'context-2', name: 'Project Two' }],
    goals: [...fixture.goals, { ...fixture.goals[0]!, id: 'goal-2', projectId: 'project-2', title: 'Second goal' }],
    runs: [...fixture.runs, { ...fixture.runs[0]!, id: 'run-2', goalId: 'goal-2' }],
    attempts: [...fixture.attempts, { ...fixture.attempts[0]!, id: 'attempt-2', runId: 'run-2' }],
  };
  render(<RouterProvider router={createMemoryRouter([{ path: '*', element: <ReviewsView data={owned} /> }], { initialEntries: ['/reviews'] })} />);
  for (const [id, context, project, goal] of [['1', 'Context One', 'Project One', 'Ship feature'], ['2', 'Context Two', 'Project Two', 'Second goal']]) {
    const card = document.querySelector(`article[data-attempt-id="attempt-${id}"]`)! as HTMLElement;
    expect(within(card).getByRole('heading').textContent).toBe('Deliver');
    expect(card.querySelector('.review-ownership')?.textContent).toBe(`${context} · ${project}Goal: ${goal}`);
    expect(within(card).getByRole('link', { name: 'Inspect evidence' }).getAttribute('href')).toBe(`/projects/project-${id}/runs/attempts/attempt-${id}`);
  }
});
it('shows explicit missing ownership without borrowing another record’s identity', () => {
  const missing = { ...fixture, runs: [], goals: [], projects: [], executionContexts: [] };
  render(<RouterProvider router={createMemoryRouter([{ path: '*', element: <ReviewsView data={missing} /> }], { initialEntries: ['/reviews'] })} />);
  expect(document.querySelector('.review-ownership')?.textContent).toBe('Unknown context · Unknown projectGoal: Unknown goal');
  expect(screen.getByRole('link', { name: 'Inspect evidence' }).getAttribute('href')).toBe('/projects/unknown/runs/attempts/attempt-1');
});
