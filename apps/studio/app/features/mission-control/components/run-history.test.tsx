import { afterEach, expect, test } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { RunsView } from './workspace-views';
import { missionControlFixture as base, fixtureAttempt } from '../../../test-support/mission-control-fixture';
afterEach(cleanup);
test('bounds the rendered attempt list for a long project without discarding operational records', () => {
  const attempts = Array.from({ length: 125 }, (_, i) => ({ ...fixtureAttempt, id: `history-${String(i).padStart(3, '0')}` }));
  const data = { ...base, attempts };
  const view = render(<RouterProvider router={createMemoryRouter([{ path: '*', element: <RunsView data={data} /> }], { initialEntries: ['/runs?context=context-1&project=project-1'] })} />);
  expect(view.container.querySelectorAll('.run-list a')).toHaveLength(30);
  expect(data.attempts).toHaveLength(125);
});

test('retains native links, scope, stable selection and named history controls', async () => {
  const attempts = Array.from({ length: 65 }, (_, i) => ({ ...fixtureAttempt, id: `history-${String(i).padStart(3, '0')}` }));
  const { runHistoryPage } = await import('../run-history');
  const first = runHistoryPage(attempts, new URL('http://studio.local/runs?context=context-1&project=project-1'));
  const path = `/runs?context=context-1&project=project-1&runCursor=${encodeURIComponent(first.older!)}&runHistory=older`;
  const view = render(<RouterProvider router={createMemoryRouter([{ path: '*', element: <RunsView data={{ ...base, attempts }} attemptId="history-020" /> }], { initialEntries: [path] })} />);
  const nav = view.getByRole('navigation', { name: 'Run history pagination' });
  expect(nav.querySelectorAll('a')).toHaveLength(3);
  expect(view.getByRole('heading', { name: 'Attempt history' }).tabIndex).toBe(-1);
  const list = view.getByRole('list', { name: 'Run attempts' });
  expect(list.querySelectorAll('[role="listitem"]')).toHaveLength(30);
  const selected = list.querySelector('a[aria-current="true"]')!;
  const target = new URL(selected.getAttribute('href')!, 'http://studio.local');
  expect(target.pathname).toContain('history-020');
  expect(target.searchParams.get('runCursor')).toBe(first.older);
  expect(target.searchParams.get('context')).toBe('context-1');
  expect(target.searchParams.get('project')).toBe('project-1');
});

test('keeps an off-page selected attempt inspectable and offers its containing page', async () => {
  const attempts = Array.from({ length: 65 }, (_, i) => ({ ...fixtureAttempt, id: `history-${String(i).padStart(3, '0')}` }));
  const { runHistoryPage } = await import('../run-history');
  const first = runHistoryPage(attempts, new URL('http://studio.local/runs?context=context-1&project=project-1'));
  const path = `/projects/project-1/runs/attempts/history-060?context=context-1&project=project-1&runCursor=${encodeURIComponent(first.older!)}&runHistory=older`;
  const view = render(<RouterProvider router={createMemoryRouter([{ path: '*', element: <RunsView data={{ ...base, attempts }} attemptId="history-060" /> }], { initialEntries: [path] })} />);
  expect(view.getByRole('status').textContent).toContain('selected attempt is outside this page');
  const link = view.getByRole('link', { name: 'Show selected attempt in history' });
  expect(link.getAttribute('href')).not.toContain('runCursor');
  expect(view.getByText('Test report')).toBeTruthy();
  expect(view.getByText('Tests failed')).toBeTruthy();
});

test('distinguishes an empty scope and a missing selected attempt', () => {
  const view = render(<RouterProvider router={createMemoryRouter([{ path: '*', element: <RunsView data={{ ...base, attempts: [] }} attemptId="missing" /> }], { initialEntries: ['/runs'] })} />);
  expect(view.getByRole('heading', { name: 'No attempts in this scope' })).toBeTruthy();
  expect(view.getByRole('heading', { name: 'Attempt not found' })).toBeTruthy();
});
