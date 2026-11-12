import { useLayoutEffect, useRef } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, Form, RouterProvider, useActionData } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import { useExecutionSubmission } from './use-execution-submission';

afterEach(cleanup);
for (const intent of ['start', 'dispatch-plan', 'cancel-goal', 'create-goal', 'create-sendero', 'import-sendero', 'create-agent', 'update-agent'] as const) it(`accepts an enabled ${intent} correction at the commit boundary after a known rejection`, async () => {
  let finish!: (value: unknown) => void;
  const action = vi.fn(() => new Promise(resolve => { finish = resolve; }));
  const observations: boolean[] = [];
  function Example() {
    const { pending, uncertain, submit } = useExecutionSubmission(intent);
    const result = useActionData<{ ok?: boolean }>();
    const form = useRef<HTMLFormElement>(null);
    useLayoutEffect(() => {
      if (result?.ok === false) {
        // Native input can arrive once the enabled DOM is committed, before
        // passive effects. Exercise that boundary without sleeps or retries.
        observations.push(!form.current!.querySelector('button')!.disabled);
        form.current!.requestSubmit();
      }
    }, [result]);
    return <Form ref={form} method="post" onSubmit={submit}><button disabled={pending || uncertain}>Submit</button></Form>;
  }
  const router = createMemoryRouter([{ path: '*', action, element: <Example /> }]);
  render(<RouterProvider router={router} />);
  fireEvent.click(screen.getByRole('button'));
  await waitFor(() => expect(action).toHaveBeenCalledOnce());
  finish({ ok: false, intent });
  await waitFor(() => expect(observations).toEqual([true]));
  await waitFor(() => expect(action).toHaveBeenCalledTimes(2));
  finish({ ok: true, intent });
});
