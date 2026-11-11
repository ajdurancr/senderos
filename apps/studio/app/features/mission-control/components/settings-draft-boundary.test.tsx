import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, Form, RouterProvider } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import { SettingsDraftBoundary } from './settings-draft-boundary';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
function setup(settingsDirty = false) {
  const action = vi.fn(() => ({ ok: false }));
  render(<RouterProvider router={createMemoryRouter([{ path: '*', action, element: <SettingsDraftBoundary settingsDirty={settingsDirty}>
    <Form method="post"><input name="intent" type="hidden" value="register-project" /><label>New project<input name="name" defaultValue="" /></label><select name="executionContextId" defaultValue="one"><option value="one">One</option><option value="two">Two</option></select><button>Add project</button><button type="reset">Discard project</button></Form>
    <Form method="post"><input name="intent" type="hidden" value="register-context" /><label>New context<input name="name" defaultValue="" /></label><button>Add context</button><button type="reset">Discard context</button></Form>
  </SettingsDraftBoundary> }])} />);
  return action;
}
function unload() { const event = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(event); return event.defaultPrevented; }
it('protects registration without a selected project and clears only the discarded form', () => {
  setup();
  expect(unload()).toBe(false);
  fireEvent.change(screen.getByLabelText('New project'), { target: { value: 'Notebook' } });
  fireEvent.change(screen.getByLabelText('New context'), { target: { value: 'Team' } });
  expect(unload()).toBe(true);
  fireEvent.click(screen.getByText('Discard project'));
  expect(unload()).toBe(true);
  fireEvent.click(screen.getByText('Discard context'));
  expect(unload()).toBe(false);
});
it('treats a changed registration context as a draft even before entering a name', () => {
  setup();
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'two' } });
  expect(unload()).toBe(true);
  fireEvent.click(screen.getByText('Discard project'));
  expect(unload()).toBe(false);
  expect(screen.getByRole('combobox')).toHaveProperty('value', 'one');
});
it.each([false, true])('requires consent for registration that would discard another draft (settings: %s)', async settingsDirty => {
  const action = setup(settingsDirty);
  if (!settingsDirty) fireEvent.change(screen.getByLabelText('New context'), { target: { value: 'Retained team' } });
  fireEvent.change(screen.getByLabelText('New project'), { target: { value: 'Notebook' } });
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  fireEvent.click(screen.getByText('Add project'));
  expect(confirm).toHaveBeenCalledOnce();
  expect(action).not.toHaveBeenCalled();
  expect(screen.getByLabelText('New project')).toHaveProperty('value', 'Notebook');
  confirm.mockReturnValue(true);
  fireEvent.click(screen.getByText('Add project'));
  await waitFor(() => expect(action).toHaveBeenCalledOnce());
  expect(unload()).toBe(true);
});
it('submits a sole registration draft without a discard prompt', async () => {
  const action = setup();
  const confirm = vi.spyOn(window, 'confirm');
  fireEvent.change(screen.getByLabelText('New context'), { target: { value: 'Team' } });
  fireEvent.click(screen.getByText('Add context'));
  await waitFor(() => expect(action).toHaveBeenCalledOnce());
  expect(confirm).not.toHaveBeenCalled();
});
