import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, useLoaderData } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import { SnapshotStatus } from './snapshot-status';

afterEach(() => { cleanup(); vi.useRealTimers(); });
function setup(asOf: number | undefined, pending = false) {
  const loader = vi.fn<() => { asOf?: number } | Promise<{ asOf?: number }>>(() => ({ asOf }));
  function View() { const data = useLoaderData() as { asOf?: number }; return <><SnapshotStatus asOf={data.asOf} pending={pending} /><input aria-label="Draft" defaultValue="Keep this" /></>; }
  const router = createMemoryRouter([{ path: '*', loader, element: <View /> }]);
  render(<RouterProvider router={router} />);
  return { loader, router };
}
it('ages a loaded snapshot without fetching or changing host facts, and clears its timer', async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-11T12:00:00Z'));
  const { loader } = setup(Date.now());
  await act(async () => { await Promise.resolve(); });
  expect(screen.queryByText(/Status may have changed/)).toBeNull();
  const loads = loader.mock.calls.length;
  await act(async () => { vi.advanceTimersByTime(60_000); });
  expect(screen.getByText(/Status may have changed/)).toBeTruthy();
  expect(loader).toHaveBeenCalledTimes(loads);
  expect(screen.getByText(/Snapshot loaded/).querySelector('time')?.dateTime).toBe('2026-11-11T12:00:00.000Z');
  cleanup(); expect(vi.getTimerCount()).toBe(0);
});
it.each([undefined, Number.NaN, Number.POSITIVE_INFINITY, 9e15])('handles unavailable or invalid observation time %s', async asOf => {
  setup(asOf);
  expect(await screen.findByText('Snapshot time unavailable')).toBeTruthy();
  expect(await screen.findByText(/Status may have changed/)).toBeTruthy();
});
it('does not allow a refresh during a submitting navigation', async () => {
  setup(Date.now(), true);
  expect(await screen.findByRole('button', { name: 'Refresh status' })).toHaveProperty('disabled', true);
});
it('keeps the busy control focusable and ignores repeated refresh requests', async () => {
  const refresh = vi.fn();
  render(<SnapshotStatus asOf={Date.now()} pending={false} refreshing onRefresh={refresh} />);
  const button = await screen.findByRole('button', { name: 'Refreshing status…' });
  expect(button).toHaveProperty('disabled', false);
  expect(button.getAttribute('aria-disabled')).toBe('true');
  fireEvent.click(button);
  expect(refresh).not.toHaveBeenCalled();
});
it('offers retry with an explicit retained-snapshot error', async () => {
  const refresh = vi.fn();
  render(<SnapshotStatus asOf={Date.now()} pending={false} error onRefresh={refresh} />);
  expect(screen.getByRole('alert').textContent).toContain('previous snapshot and your edits are kept');
  fireEvent.click(await screen.findByRole('button', { name: 'Refresh status' }));
  expect(refresh).toHaveBeenCalledOnce();
});
