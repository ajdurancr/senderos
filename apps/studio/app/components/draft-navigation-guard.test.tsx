import { useLayoutEffect, useState } from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { DraftNavigationGuard } from './draft-navigation-guard';

afterEach(cleanup);
beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.open = true; } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.open = false; } });
});
test('navigation at the save commit reads the current draft state before blocker effects refresh', async () => {
  let saved!: () => void;
  const router = createMemoryRouter([
    { path: '/', element: <Editor /> },
    { path: '/done', element: <p>Finished navigation</p> },
  ]);
  function Editor() {
    const [dirty, setDirty] = useState(true);
    saved = () => setDirty(false);
    useLayoutEffect(() => { if (!dirty) void router.navigate('/done'); }, [dirty]);
    return <DraftNavigationGuard dirty={dirty} saving={false} subject="project settings" />;
  }
  render(<RouterProvider router={router} />);
  await act(async () => saved());
  expect(router.state.location.pathname).toBe('/done');
  expect(screen.getByText('Finished navigation')).toBeTruthy();
});

test('navigation at a new draft commit cannot use the previous clean blocker policy', async () => {
  let edit!: () => void;
  const router = createMemoryRouter([
    { path: '/', element: <Editor /> },
    { path: '/done', element: <p>Finished navigation</p> },
  ]);
  function Editor() {
    const [dirty, setDirty] = useState(false);
    edit = () => setDirty(true);
    useLayoutEffect(() => { if (dirty) void router.navigate('/done'); }, [dirty]);
    return <DraftNavigationGuard dirty={dirty} saving={false} subject="project settings" />;
  }
  render(<RouterProvider router={router} />);
  await act(async () => edit());
  expect(router.state.location.pathname).toBe('/');
  expect(screen.getByRole('dialog', { name: 'Leave project settings editor?' })).toBeTruthy();
  expect(screen.queryByText('Finished navigation')).toBeNull();
});


test('a live registry protects edits before the owning form rerenders', async () => {
  let dirty = false;
  const router = createMemoryRouter([
    { path: '/', element: <DraftNavigationGuard dirty={false} isDirty={() => dirty} saving={false} subject="project settings" /> },
    { path: '/done', element: <p>Finished navigation</p> },
  ]);
  render(<RouterProvider router={router} />);
  dirty = true;
  await act(async () => { await router.navigate('/done'); });
  expect(router.state.location.pathname).toBe('/');
  expect(screen.getByRole('dialog', { name: 'Leave project settings editor?' })).toBeTruthy();
});

test('a save does not automatically replay an already blocked navigation', async () => {
  let saved!: () => void;
  function Editor() {
    const [dirty, setDirty] = useState(true);
    saved = () => setDirty(false);
    return <DraftNavigationGuard dirty={dirty} saving={false} subject="project settings" />;
  }
  const router = createMemoryRouter([
    { path: '/', element: <Editor /> },
    { path: '/done', element: <p>Finished navigation</p> },
  ]);
  render(<RouterProvider router={router} />);
  await act(async () => { await router.navigate('/done'); });
  await act(async () => saved());
  expect(router.state.location.pathname).toBe('/');
  expect(screen.getByRole('dialog', { name: 'Leave project settings editor?' }).textContent).toContain('edits are now saved');
  await act(async () => screen.getByRole('button', { name: 'Leave editor' }).click());
  expect(router.state.location.pathname).toBe('/done');
});
