import { useEffect, useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, useNavigate } from 'react-router';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { InspectorDraftBoundary, useInspectorDraft } from './inspector-draft-boundary';

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});
afterEach(cleanup);
function Draft({ kind, saving = false }: { kind: 'attempt' | 'budget'; saving?: boolean }) {
  const [dirty, setDirty] = useState(false);
  useInspectorDraft(kind, dirty, saving);
  return <button onClick={() => setDirty(!dirty)}>Toggle {kind}</button>;
}
function show(disabled = false, saving = false) {
  function Editor() {
    const [visible, setVisible] = useState(true);
    return <InspectorDraftBoundary disabled={disabled}>
      <Draft kind="attempt" /><Draft kind="budget" saving={saving} />
      {visible && <Draft kind="budget" />}
      <button onClick={() => setVisible(false)}>Remove extra budget</button>
    </InspectorDraftBoundary>;
  }
  const router = createMemoryRouter([{ path: '*', element: <Editor /> }]);
  render(<RouterProvider router={router} />);
  return router;
}
it('combines attempt and multiple budget drafts behind one accessible navigation dialog', async () => {
  const router = show();
  fireEvent.click(screen.getByRole('button', { name: 'Toggle attempt' }));
  for (const button of screen.getAllByRole('button', { name: 'Toggle budget' })) fireEvent.click(button);
  await router.navigate('/other');
  await waitFor(() => expect(screen.getAllByRole('dialog')).toHaveLength(1));
  expect(screen.getByRole('dialog').textContent).toContain('evidence, review and execution budgets');
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Stay here' }));
  fireEvent.click(screen.getByRole('button', { name: 'Stay here' }));
  expect(router.state.location.pathname).toBe('/');
});
it('removes a discarded editor from the registered navigation boundary', async () => {
  const router = show();
  fireEvent.click(screen.getAllByRole('button', { name: 'Toggle budget' })[1]!);
  fireEvent.click(screen.getByRole('button', { name: 'Remove extra budget' }));
  await router.navigate('/other');
  await waitFor(() => expect(router.state.location.pathname).toBe('/other'));
  expect(screen.queryByRole('dialog')).toBeNull();
});
it('explains persisted inspection when a budget confirmation is pending', async () => {
  const router = show(false, true);
  fireEvent.click(screen.getAllByRole('button', { name: 'Toggle budget' })[0]!);
  await router.navigate('/other');
  await waitFor(() => expect(screen.getByRole('dialog').textContent).toContain('inspect persisted execution budgets'));
  fireEvent.click(screen.getByRole('button', { name: 'Leave editor' }));
  await waitFor(() => expect(router.state.location.pathname).toBe('/other'));
});
it('yields its router guard to goal preparation when disabled', async () => {
  const router = show(true);
  fireEvent.click(screen.getByRole('button', { name: 'Toggle attempt' }));
  await router.navigate('/other');
  await waitFor(() => expect(router.state.location.pathname).toBe('/other'));
  expect(screen.queryByRole('dialog')).toBeNull();
});

it('registers newly dirty inputs before a subsequent navigation effect can leave the inspector', async () => {
  function Editor() {
    const [dirty, setDirty] = useState(false);
    const navigate = useNavigate();
    useInspectorDraft('attempt', dirty, false);
    useEffect(() => { if (dirty) void navigate('/other'); }, [dirty, navigate]);
    return <button onClick={() => setDirty(true)}>Edit then navigate</button>;
  }
  const router = createMemoryRouter([{ path: '*', element: <InspectorDraftBoundary disabled={false}><Editor /></InspectorDraftBoundary> }]);
  render(<RouterProvider router={router} />);
  fireEvent.click(screen.getByRole('button', { name: 'Edit then navigate' }));
  await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());
  expect(router.state.location.pathname).toBe('/');
});
