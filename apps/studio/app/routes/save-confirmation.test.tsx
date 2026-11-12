import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, redirect, RouterProvider } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import Home, { shouldRevalidate } from './home';
import { missionControlFixture } from '../test-support/mission-control-fixture';
afterEach(cleanup);
const entry = `/agents/${missionControlFixture.agents[0].id}?saved=create-agent`;
async function fragment(router: ReturnType<typeof createMemoryRouter>, hash: string) {
  await router.navigate({ pathname: router.state.location.pathname, search: router.state.location.search, hash });
}
it('does not present historical creation as confirmation after an uncertain edit loses fragment feedback', async () => {
  const loader = vi.fn(() => ({ ...missionControlFixture }));
  const action = vi.fn(() => ({ ok: false, intent: 'update-agent', transportFailure: true, message: 'Studio could not confirm this edit.' }));
  const router = createMemoryRouter([{ path: '*', loader, action, shouldRevalidate, element: <Home /> }], { initialEntries: [`/agents/${missionControlFixture.agents[0].id}?saved=create-agent`] });
  render(<RouterProvider router={router} />);
  await screen.findByText('Agent created.', { exact: true });
  const save = screen.getByRole('button', { name: 'Save agent' });
  await waitFor(() => expect(save).toHaveProperty('disabled', false));
  fireEvent.change(screen.getByLabelText('Instructions'), { target: { value: 'Retain the uncertain edit.' } });
  fireEvent.submit(save.closest('form')!);
  await screen.findByText('Studio could not confirm this edit.', { exact: true });
  expect(screen.queryByText('Agent created.', { exact: true })).toBeNull();
  await router.navigate({ pathname: router.state.location.pathname, search: router.state.location.search, hash: '#inspection' });
  await waitFor(() => expect(router.state.location.hash).toBe('#inspection'));
  expect(router.state.actionData).toBeNull();
  expect(loader).toHaveBeenCalledOnce(); expect(action).toHaveBeenCalledOnce();
  expect(save).toHaveProperty('disabled', true);
  expect(screen.getByLabelText('Instructions')).toHaveProperty('value', 'Retain the uncertain edit.');
  expect(screen.queryByText('Agent created.', { exact: true })).toBeNull();
  router.revalidate();
  await waitFor(() => expect(router.state.revalidation).toBe('idle'));
  expect(save).toHaveProperty('disabled', true);
  expect(screen.queryByText('Agent created.', { exact: true })).toBeNull();
});

it('consumes earlier success while pending and after a known rejection, including Back/Forward', async () => {
  let release!: (value: unknown) => void;
  const loader = vi.fn(() => ({ ...missionControlFixture }));
  const action = vi.fn(() => new Promise(resolve => { release = resolve; }));
  const router = createMemoryRouter([{ path: '*', loader, action, shouldRevalidate, element: <Home /> }], { initialEntries: [entry] });
  render(<RouterProvider router={router} />);
  await screen.findByText('Agent created.', { exact: true });
  const save = screen.getByRole('button', { name: 'Save agent' });
  await waitFor(() => expect(save).toHaveProperty('disabled', false));
  fireEvent.submit(save.closest('form')!);
  await waitFor(() => expect(action).toHaveBeenCalledOnce());
  expect(screen.queryByText('Agent created.', { exact: true })).toBeNull();
  release({ ok: false, intent: 'update-agent', message: 'Synthetic known rejection' });
  await screen.findByText('Synthetic known rejection', { exact: true });
  await fragment(router, '#inspection');
  await waitFor(() => expect(router.state.actionData).toBeNull());
  expect(screen.queryByText('Agent created.', { exact: true })).toBeNull();
  await router.navigate(-1); await router.navigate(1);
  expect(screen.queryByText('Agent created.', { exact: true })).toBeNull();
  expect(action).toHaveBeenCalledOnce();
});

it('shows a new confirmed redirect and success on authoritative document readback', async () => {
  const loader = vi.fn(() => ({ ...missionControlFixture }));
  const action = vi.fn(() => redirect(entry.replace('saved=create-agent', 'saved=update-agent')));
  const router = createMemoryRouter([{ path: '*', loader, action, shouldRevalidate, element: <Home /> }], { initialEntries: [entry] });
  const view = render(<RouterProvider router={router} />);
  await screen.findByText('Agent created.', { exact: true });
  const save = screen.getByRole('button', { name: 'Save agent' });
  await waitFor(() => expect(save).toHaveProperty('disabled', false));
  fireEvent.submit(save.closest('form')!);
  await screen.findByText('Agent changes saved.', { exact: true });
  expect(loader).toHaveBeenCalledTimes(2); expect(action).toHaveBeenCalledOnce();
  view.unmount();
  const readback = createMemoryRouter([{ path: '*', loader, element: <Home /> }], { initialEntries: [entry.replace('saved=create-agent', 'saved=update-agent')] });
  render(<RouterProvider router={readback} />);
  await screen.findByText('Agent changes saved.', { exact: true });
  expect(loader).toHaveBeenCalledTimes(3); expect(action).toHaveBeenCalledOnce();
});
