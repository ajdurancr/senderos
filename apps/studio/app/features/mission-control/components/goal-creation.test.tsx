import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, type ActionFunction } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { missionControlFixture as data } from '../../../test-support/mission-control-fixture';
import { GoalCreation } from './goal-creation';

afterEach(cleanup);
const graphs = data.senderoGraphs.map(graph => ({ ...graph, version: { ...graph.version, status: 'published' as const } }));
function mount(action: ActionFunction = vi.fn(() => ({ ok: false, intent: 'create-goal' })), published = graphs) {
  const router = createMemoryRouter([{ path: '*', action, element: <GoalCreation projectId="project-1" graphs={published} /> }], { initialEntries: ['/projects/project-1/goals/new'] });
  render(<RouterProvider router={router} />);
  return router;
}

describe('new goal creation recovery', () => {
  it('preserves correctable rejected input and discards without another mutation', async () => {
    const forms: FormData[] = [];
    const router = createMemoryRouter([{ path: '*', action: async ({ request }) => { forms.push(await request.formData()); return { ok: false, intent: 'create-goal' }; }, element: <GoalCreation projectId="project-1" graphs={graphs} /> }]);
    render(<RouterProvider router={router} />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Create goal' })).toHaveProperty('disabled', false));
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Keep this title' } });
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'research' } });
    fireEvent.change(screen.getByLabelText('Specification'), { target: { value: 'Acceptance criteria' } });
    fireEvent.submit(screen.getByRole('form', { name: 'New goal' }));
    await waitFor(() => expect(forms).toHaveLength(1));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Create goal' })).toHaveProperty('disabled', false));
    expect(Object.fromEntries(forms[0]!)).toMatchObject({ intent: 'create-goal', projectId: 'project-1', title: 'Keep this title', kind: 'research', specText: 'Acceptance criteria', senderoVersionId: graphs[0]!.version.id });
    expect(screen.getByLabelText('Title')).toHaveProperty('value', 'Keep this title');
    fireEvent.click(screen.getByRole('button', { name: 'Discard goal draft' }));
    expect(screen.getByLabelText('Title')).toHaveProperty('value', '');
    expect(screen.getByLabelText('Category')).toHaveProperty('value', 'task');
    expect(screen.getByLabelText('Specification')).toHaveProperty('value', '');
    expect(forms).toHaveLength(1);
  });
  it('locks submitted identity and repeated submissions until uncertain creation is inspected', async () => {
    let finish!: (value: unknown) => void;
    const action = vi.fn(() => new Promise(resolve => { finish = resolve; }));
    mount(action);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Create goal' })).toHaveProperty('disabled', false));
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Unconfirmed outcome' } });
    const form = screen.getByRole('form', { name: 'New goal' });
    fireEvent.submit(form); fireEvent.submit(form);
    await waitFor(() => expect(action).toHaveBeenCalledOnce());
    expect(screen.getByRole('group', { name: 'New goal details' })).toHaveProperty('disabled', true);
    finish({ ok: false, intent: 'create-goal', transportFailure: true });
    await screen.findByRole('button', { name: 'Reload persisted goals' });
    expect(screen.getByRole('button', { name: 'Create goal' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Discard goal draft' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('status').textContent).toContain('creating it again can add another goal');
    fireEvent.submit(form); expect(action).toHaveBeenCalledOnce();
  });
  it('keeps unpublished workflows unavailable for creation', async () => {
    const action = vi.fn();
    mount(action, []);
    await waitFor(() => expect(screen.getByLabelText('Title')).toHaveProperty('disabled', false));
    expect(screen.getByText('Publish a Sendero before creating a goal.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Create goal' })).toHaveProperty('disabled', true);
    fireEvent.submit(screen.getByRole('form', { name: 'New goal' }));
    expect(action).not.toHaveBeenCalled();
  });
});
