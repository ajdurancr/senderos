import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import { LocalRegistration } from './local-registration';
import { missionControlFixture as fixture } from '../../../test-support/mission-control-fixture';

afterEach(cleanup);
it('makes context selection explicit, retains failed input, and disables a pending registration', async () => {
  let finish!: (value: unknown) => void;
  const submissions: FormData[] = [];
  const action = vi.fn(async ({ request }: { request: Request }) => {
    submissions.push(await request.formData());
    return new Promise(resolve => { finish = resolve; });
  });
  const contexts = [...fixture.executionContexts, { ...fixture.executionContexts[0]!, id: 'another-context', name: 'Other team' }];
  render(<RouterProvider router={createMemoryRouter([{ path: '*', element: <LocalRegistration data={{ ...fixture, executionContexts: contexts, projects: [] }} />, action }])} />);
  const context = screen.getByRole('combobox', { name: /^Project execution context/ }) as HTMLSelectElement;
  expect(context.value).toBe('');
  fireEvent.change(screen.getByRole('textbox', { name: /^Project name/ }), { target: { value: 'Notebook' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add project' }));
  expect(action).not.toHaveBeenCalled();
  fireEvent.change(context, { target: { value: 'another-context' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add project' }));
  await waitFor(() => expect(submissions).toHaveLength(1));
  expect(Object.fromEntries(submissions[0]!)).toEqual({ intent: 'register-project', name: 'Notebook', executionContextId: 'another-context' });
  expect(screen.getAllByRole('button', { name: 'Saving…' }).every(button => (button as HTMLButtonElement).disabled)).toBe(true);
  finish({ ok: false });
  await screen.findByRole('button', { name: 'Add project' });
  expect(screen.getByRole('textbox', { name: /^Project name/ })).toHaveProperty('value', 'Notebook');
});
it('provides a first-context path and prevents project registration without a context', async () => {
  const action = vi.fn(() => null);
  render(<RouterProvider router={createMemoryRouter([{ path: '*', element: <LocalRegistration data={{ ...fixture, executionContexts: [], projects: [] }} />, action }])} />);
  expect(screen.getByRole('button', { name: 'Add project' })).toHaveProperty('disabled', true);
  expect(screen.getByText('Add an execution context below first.')).toBeTruthy();
  fireEvent.change(screen.getByRole('textbox', { name: /^Context name/ }), { target: { value: 'My team' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add context' }));
  await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
});
it('preselects the current project context and remounts unsaved registration on scope changes', async () => {
  const router = createMemoryRouter([{ path: '*', element: <LocalRegistration data={{ ...fixture, executionContexts: [...fixture.executionContexts, { ...fixture.executionContexts[0]!, id: 'another-context', name: 'Other team' }] }} projectId={fixture.projects[0]!.id} /> }], { initialEntries: ['/settings'] });
  render(<RouterProvider router={router} />);
  fireEvent.click(screen.getByText('Add a project'));
  const input = screen.getByRole('textbox', { name: /^Project name/ });
  fireEvent.change(input, { target: { value: 'Unsaved notebook' } });
  expect(screen.getByRole('combobox', { name: /^Project execution context/ })).toHaveProperty('value', fixture.projects[0]!.executionContextId);
  await router.navigate('/settings?context=another-context');
  await waitFor(() => expect(screen.getByRole('combobox', { name: /^Project execution context/ })).toHaveProperty('value', 'another-context'));
  expect(screen.getByRole('textbox', { name: /^Project name/ })).not.toBe(input);
  expect(screen.getByRole('textbox', { name: /^Project name/ })).toHaveProperty('value', '');
});
