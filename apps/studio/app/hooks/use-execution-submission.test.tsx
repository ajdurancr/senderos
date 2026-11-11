import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, Form, RouterProvider } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import { useExecutionSubmission } from './use-execution-submission';

afterEach(cleanup);
function Example({ intent }: { intent: 'start' | 'dispatch-plan' | 'cancel-goal' }) {
  const { pending, uncertain, submit } = useExecutionSubmission(intent);
  return <Form method="post" aria-label="Execution action" onSubmit={submit}><button disabled={pending || uncertain}>Submit</button></Form>;
}
for (const intent of ['start', 'dispatch-plan', 'cancel-goal'] as const) {
  it(`blocks repeated ${intent} submissions before and during navigation, then permits a rejected action to be corrected`, async () => {
    let finish!: (value: unknown) => void;
    const action = vi.fn(() => new Promise(resolve => { finish = resolve; }));
    const router = createMemoryRouter([{ path: '*', element: <Example intent={intent} />, action }]);
    render(<RouterProvider router={router} />);
    const form = screen.getByRole('form');
    fireEvent.submit(form); fireEvent.submit(form);
    await waitFor(() => expect(action).toHaveBeenCalledOnce());
    expect(screen.getByRole('button')).toHaveProperty('disabled', true);
    fireEvent.submit(form); expect(action).toHaveBeenCalledOnce();
    finish({ ok: false, intent, message: 'Reviewed state changed' });
    await waitFor(() => expect(screen.getByRole('button')).toHaveProperty('disabled', false));
    fireEvent.submit(form);
    await waitFor(() => expect(action).toHaveBeenCalledTimes(2));
    finish({ ok: true, intent });
    await waitFor(() => expect(screen.getByRole('button')).toHaveProperty('disabled', false));
  });
  it(`does not replay uncertain ${intent} until a fresh page is loaded`, async () => {
    const action = vi.fn(async () => ({ ok: false, intent, transportFailure: true }));
    const router = createMemoryRouter([{ path: '*', element: <Example intent={intent} />, action }]);
    render(<RouterProvider router={router} />);
    fireEvent.submit(screen.getByRole('form'));
    await waitFor(() => expect(action).toHaveBeenCalledOnce());
    await waitFor(() => expect(router.state.navigation.state).toBe('idle'));
    expect(screen.getByRole('button')).toHaveProperty('disabled', true);
    fireEvent.submit(screen.getByRole('form')); expect(action).toHaveBeenCalledOnce();
    await router.navigate('#recovery');
    await waitFor(() => expect(router.state.location.hash).toBe('#recovery'));
    expect(router.state.actionData).toBeNull();
    expect(screen.getByRole('button')).toHaveProperty('disabled', true);
    fireEvent.submit(screen.getByRole('form'));
    expect(action).toHaveBeenCalledOnce();
  });
}
