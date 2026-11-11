import { cleanup, fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import { DispatchTray } from './dispatch-tray';
import { missionControlFixture as fixture } from '../../../test-support/mission-control-fixture';
import type { MissionControlData } from '../server';

afterEach(cleanup);
function show(attemptsUsed?: number, previousRunId: string | null = 'successful-parent') {
  const item = { ...fixture.queue.dispatchable[0]!, previousRunId };
  const data = { ...fixture, queue: { ...fixture.queue, dispatchable: [item] }, activations: attemptsUsed === undefined ? [] : [{ id: item.activationId, goalId: item.goalId, attemptsUsed }] } as MissionControlData;
  const action = vi.fn(async ({ request }: { request: Request }) => Object.fromEntries(await request.formData()));
  const router = createMemoryRouter([{ path: '*', element: <DispatchTray data={data} />, action }]);
  render(<RouterProvider router={router} />);
  return { item, action, row: within(document.querySelector('.dispatch-items article')!) };
}
it('labels a fresh successor as a new run while retaining its successful parent lineage in the reviewed plan', async () => {
  const { item, action, row } = show(0);
  expect(row.getByText('new run')).toBeTruthy();
  expect(row.queryByText('retry')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /Dispatch all/ }));
  await waitFor(() => expect(action).toHaveBeenCalledOnce());
  expect(JSON.parse((await action.mock.results[0]!.value).reviewedItems as string)).toEqual([item]);
});
it('labels a later attempt on the same activation as a retry', () => {
  const { row } = show(2, 'failed-attempt-run');
  expect(row.getByText('retry')).toBeTruthy();
  expect(row.queryByText('new run')).toBeNull();
});
it('labels an entry activation without a predecessor as a new run', () => {
  expect(show(0, null).row.getByText('new run')).toBeTruthy();
});
it('does not infer retry status from lineage when activation usage is unavailable', () => {
  const { row } = show();
  expect(row.getByText('run', { exact: true })).toBeTruthy();
  expect(row.queryByText('retry')).toBeNull();
});
