import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, useLoaderData } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { missionControlFixture as base } from '../../../test-support/mission-control-fixture';
import { GoalPreparation } from './goal-preparation';

afterEach(cleanup);
const initial = { ...base.goals[0]!, status: 'draft' as const };
const graphs = base.senderoGraphs.map(graph => ({ ...graph, version: { ...graph.version, status: 'published' as const } }));

describe('goal preparation', () => {
  it('keeps starting separate, retains rejected edits, and cancels without a write', async () => {
    const action = vi.fn(() => ({ ok: false, intent: 'update-goal' }));
    const editing = vi.fn();
    const router = createMemoryRouter([{ path: '*', action, element: <GoalPreparation goal={initial} graphs={graphs} onEditingChange={editing} /> }]);
    render(<RouterProvider router={router} />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Edit goal' })).toHaveProperty('disabled', false));
    fireEvent.click(screen.getByRole('button', { name: 'Edit goal' }));
    expect(screen.queryByRole('button', { name: 'Start goal' })).toBeNull();
    fireEvent.change(screen.getByLabelText('Goal title'), { target: { value: 'Local revision' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save goal draft' }));
    await waitFor(() => expect(action).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save goal draft' })).toHaveProperty('disabled', false));
    expect(screen.getByLabelText('Goal title')).toHaveProperty('value', 'Local revision');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel preparation' }));
    expect(action).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Edit goal' }));
    expect(screen.getByLabelText('Goal title')).toHaveProperty('value', initial.title);
  });
  it('uses the reviewed snapshot and closes after a successful save without activating', async () => {
    let current = initial;
    const submissions: FormData[] = [];
    function Editor() { return <GoalPreparation goal={useLoaderData() as typeof initial} graphs={graphs} onEditingChange={() => {}} />; }
    const router = createMemoryRouter([{ path: '*', loader: () => current, action: async ({ request }) => {
      const form = await request.formData(); submissions.push(form);
      current = { ...current, title: String(form.get('title')) };
      return { ok: true, intent: 'update-goal' };
    }, element: <Editor /> }]);
    render(<RouterProvider router={router} />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Edit goal' })).toHaveProperty('disabled', false));
    fireEvent.click(screen.getByRole('button', { name: 'Edit goal' }));
    fireEvent.change(screen.getByLabelText('Goal title'), { target: { value: 'Saved revision' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save goal draft' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Edit goal' })).toHaveProperty('disabled', false));
    expect(submissions).toHaveLength(1);
    expect(JSON.parse(String(submissions[0]!.get('expectedDraft')))).toEqual({ title: initial.title, kind: initial.kind, specText: initial.specText, senderoVersionId: initial.senderoVersionId });
    expect(current.status).toBe('draft');
    fireEvent.click(screen.getByRole('button', { name: 'Edit goal' }));
    expect(screen.getByLabelText('Goal title')).toHaveProperty('value', 'Saved revision');
  });
  it('requires persisted-state readback after an uncertain activation before starting or editing again', async () => {
    const action = vi.fn(() => ({ ok: false, intent: 'start', transportFailure: true }));
    const router = createMemoryRouter([{ path: '*', action, element: <GoalPreparation goal={initial} graphs={graphs} onEditingChange={() => {}} /> }]);
    render(<RouterProvider router={router} />);
    const start = await screen.findByRole('button', { name: 'Start goal' });
    await waitFor(() => expect(start).toHaveProperty('disabled', false));
    fireEvent.submit(start.closest('form')!);
    await waitFor(() => expect(action).toHaveBeenCalledOnce());
    await waitFor(() => expect(start).toHaveProperty('disabled', true));
    expect(screen.getByRole('button', { name: 'Edit goal' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Reload persisted goal and workflow progress' })).toHaveProperty('type', 'button');
    fireEvent.submit(start.closest('form')!);
    expect(action).toHaveBeenCalledOnce();
  });
  it('guides an unassigned draft to preparation and does not offer an executable start', async () => {
    const router = createMemoryRouter([{ path: '*', element: <GoalPreparation goal={{ ...initial, senderoVersionId: null }} graphs={[]} onEditingChange={() => {}} /> }]);
    render(<RouterProvider router={router} />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Edit goal' })).toHaveProperty('disabled', false));
    expect(screen.getByRole('button', { name: 'Start goal' })).toHaveProperty('disabled', true);
    fireEvent.click(screen.getByRole('button', { name: 'Edit goal' }));
    expect(screen.getByText(/No current published Senderos/)).toBeTruthy();
    expect(screen.getByLabelText('Goal workflow')).toHaveProperty('value', '');
  });
});
