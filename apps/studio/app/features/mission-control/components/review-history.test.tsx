import { cleanup, render, screen } from '@testing-library/react';
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
