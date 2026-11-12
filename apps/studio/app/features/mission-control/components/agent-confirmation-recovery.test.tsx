import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import { missionControlFixture } from '../../../test-support/mission-control-fixture';
import { AgentAuthoring } from './agent-authoring';

afterEach(cleanup);
for (const create of [true, false]) {
  it(`retains ${create ? 'new' : 'edited'} agent inputs and blocks repeats through pending and uncertain confirmation`, async () => {
    let finish!: (value: unknown) => void;
    const action = vi.fn(() => new Promise(resolve => { finish = resolve; }));
    const path = create ? '/agents/new' : `/agents/${missionControlFixture.agents[0].id}`;
    const router = createMemoryRouter([{ path: '*', action, element: <AgentAuthoring data={missionControlFixture} create={create} agentId={create ? undefined : missionControlFixture.agents[0].id} /> }], { initialEntries: [path] });
    render(<RouterProvider router={router} />);
    const save = screen.getByRole('button', { name: create ? 'Create agent' : 'Save agent' });
    await waitFor(() => expect(save).toHaveProperty('disabled', false));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Reviewed agent' } });
    fireEvent.change(screen.getByLabelText('Instructions'), { target: { value: 'Retain these reviewed instructions.' } });
    const form = save.closest('form')!;
    fireEvent.submit(form); fireEvent.submit(form);
    await waitFor(() => expect(action).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole('link', { name: 'Close agent editor' }));
    fireEvent.reset(form);
    expect(router.state.location.pathname).toBe(path);
    expect(screen.getByLabelText('Instructions')).toHaveProperty('value', 'Retain these reviewed instructions.');
    finish({ ok: false, intent: create ? 'create-agent' : 'update-agent', transportFailure: true });
    await screen.findByRole('button', { name: 'Reload persisted agents' });
    expect(screen.getByRole('status').textContent).toContain('never repeats');
    await router.navigate('#inspection');
    await waitFor(() => expect(router.state.location.hash).toBe('#inspection'));
    expect(router.state.actionData).toBeNull();
    expect(save).toHaveProperty('disabled', true);
    fireEvent.submit(form); fireEvent.click(screen.getByRole('link', { name: 'Close agent editor' })); fireEvent.reset(form);
    expect(action).toHaveBeenCalledOnce();
    expect(router.state.location.pathname).toBe(path);
    expect(screen.getByLabelText('Name')).toHaveProperty('value', 'Reviewed agent');
    expect(screen.getByLabelText('Instructions')).toHaveProperty('value', 'Retain these reviewed instructions.');
  });
}
