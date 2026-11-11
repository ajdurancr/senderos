import { afterEach, expect, test } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { EventsView } from './activity-history';
import { HostExecutionRecords } from './execution-records';
import { missionControlFixture as base } from '../../../test-support/mission-control-fixture';
afterEach(cleanup);
function show(element: React.ReactNode, path = '/events?context=context-1&project=project-1') {
  return render(<RouterProvider router={createMemoryRouter([{ path: '*', element }], { initialEntries: [path] })} />);
}
test('offers named native links, durable scope and full event details', () => {
  show(<EventsView data={{ ...base, activityPage: { older: 'older-position', newer: 'newer-position', historical: true } }} />);
  const nav = screen.getByRole('navigation', { name: 'Activity history pagination' });
  const older = nav.querySelector('a[href*="history=older"]')!;
  const url = new URL(older.getAttribute('href')!, 'http://studio.local');
  expect(url.searchParams.get('cursor')).toBe('older-position');
  expect(url.searchParams.get('project')).toBe('project-1');
  expect(url.searchParams.get('context')).toBe('context-1');
  expect(url.hash).toBe('#activity-history');
  expect(screen.getByRole('heading', { name: 'Activity history' }).tabIndex).toBe(-1);
  expect(within(nav).getByRole('link', { name: 'Newer events' })).toBeTruthy();
  expect(new URL(within(nav).getByRole('link', { name: 'Latest activity' }).getAttribute('href')!, 'http://studio.local').searchParams.has('cursor')).toBe(false);
  const list = screen.getByRole('list', { name: 'Activity events' });
  expect(within(list).getAllByRole('listitem')).toHaveLength(base.events.length);
  fireEvent.click(screen.getByText('Event details'));
  expect(screen.getByText('Recorded at')).toBeTruthy();
  expect(screen.getByText(base.events[0]!.createdAt)).toBeTruthy();
});
test.each([false, true])('distinguishes an empty scope from an exhausted historical position (%s)', historical => {
  show(<EventsView data={{ ...base, events: [], activityPage: { older: null, newer: null, historical, notice: 'Invalid position reset.' } }} />);
  expect(screen.getByRole('heading', { name: historical ? 'No events at this history position' : 'No events in this scope' })).toBeTruthy();
  expect(screen.getByRole('status').textContent).toBe('Invalid position reset.');
  expect(screen.queryByRole('link', { name: 'Older events' })).toBeNull();
});
test('shows the durable host recovery detail even when its old event is outside the bounded history page', () => {
  show(<HostExecutionRecords data={{ ...base, events: [] }} attempt={{ ...base.attempts[0]!, recoveryOutcome: 'unknown', recoveryDetails: { details: 'Inspected host could not establish worker state' } }} />);
  expect(screen.getByText(/Recovery observation: Inspected host/)).toBeTruthy();
});
