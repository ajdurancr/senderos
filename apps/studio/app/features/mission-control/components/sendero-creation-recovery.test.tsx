import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import { SenderoCreation } from './sendero-authoring';

afterEach(cleanup);
for (const mode of ['create', 'import'] as const) {
  it(`freezes both ${mode} drafts and Cancel through pending and uncertain confirmation`, async () => {
    let finish!: (value: unknown) => void;
    const action = vi.fn(() => new Promise(resolve => { finish = resolve; }));
    const router = createMemoryRouter([{ path: '*', action, element: <SenderoCreation /> }], { initialEntries: ['/senderos/new'] });
    render(<RouterProvider router={router} />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Create draft' })).toHaveProperty('disabled', false));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Reviewed workflow' } });
    fireEvent.change(screen.getByLabelText('Slug'), { target: { value: 'reviewed-workflow' } });
    fireEvent.change(screen.getByLabelText('Authoring method'), { target: { value: 'import' } });
    fireEvent.change(screen.getByLabelText('Sendero JSON'), { target: { value: '{"name":"Reviewed import"}' } });
    fireEvent.change(screen.getByLabelText('Authoring method'), { target: { value: mode } });
    const form = screen.getByRole('form', { name: 'New workflow' });
    fireEvent.submit(form); fireEvent.submit(form);
    await waitFor(() => expect(action).toHaveBeenCalledOnce());
    expect(screen.getByRole('group', { name: 'Workflow details' })).toHaveProperty('disabled', true);
    fireEvent.click(screen.getByRole('link', { name: 'Cancel' }));
    fireEvent.reset(form);
    expect(router.state.location.pathname).toBe('/senderos/new');
    expect(screen.getByLabelText(mode === 'create' ? 'Name' : 'Sendero JSON')).toHaveProperty('value', mode === 'create' ? 'Reviewed workflow' : '{"name":"Reviewed import"}');
    finish({ ok: false, intent: mode === 'create' ? 'create-sendero' : 'import-sendero', transportFailure: true });
    await screen.findByRole('button', { name: 'Reload persisted workflows' });
    expect(screen.getByRole('status').textContent).toContain('never repeats creation or import');
    await router.navigate('#inspection');
    await waitFor(() => expect(router.state.location.hash).toBe('#inspection'));
    expect(router.state.actionData).toBeNull();
    expect(screen.getByRole('group', { name: 'Workflow details' })).toHaveProperty('disabled', true);
    fireEvent.submit(form); fireEvent.click(screen.getByRole('link', { name: 'Cancel' })); fireEvent.reset(form);
    expect(action).toHaveBeenCalledOnce();
    expect(router.state.location.pathname).toBe('/senderos/new');
    expect(screen.getByLabelText(mode === 'create' ? 'Name' : 'Sendero JSON')).toHaveProperty('value', mode === 'create' ? 'Reviewed workflow' : '{"name":"Reviewed import"}');
  });
}
