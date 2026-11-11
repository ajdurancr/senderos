import { afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, redirect, RouterContextProvider, RouterProvider } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { missionControlFixture } from "../test-support/mission-control-fixture";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

import Home, { meta, clientAction, shouldRevalidate } from "./home";

describe("home route", () => {
  it("identifies an old snapshot and refreshes it without discarding unsaved inputs", async () => {
    const refresh = vi.fn().mockResolvedValue(Response.json({ ok: true, data: { ...missionControlFixture, asOf: Date.now() } }));
    vi.stubGlobal('fetch', refresh);
    const router = createMemoryRouter([{ path: '*', loader: () => ({ ...missionControlFixture, asOf: Date.now() - 120_000 }), element: <Home /> }], { initialEntries: ['/agents/new'] });
    render(<RouterProvider router={router} />);
    await screen.findByText('Define a custom agent');
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Unsaved operator input' } });
    expect(await screen.findByText('Status may have changed. Refresh before acting on host or recovery information.')).toBeTruthy();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Refresh status' })).toHaveProperty('disabled', false));
    fireEvent.click(screen.getByRole('button', { name: 'Refresh status' }));
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.queryByText('Status may have changed. Refresh before acting on host or recovery information.')).toBeNull());
    expect(screen.getByLabelText('Name')).toHaveProperty('value', 'Unsaved operator input');
  });

  it('retains unsaved input and the previous timestamp through a failed refresh and retry', async () => {
    const asOf = Date.now() - 120_000;
    const refresh = vi.fn().mockRejectedValueOnce(new Error('Synthetic outage')).mockResolvedValueOnce(Response.json({ ok: true, data: { ...missionControlFixture, asOf: Date.now() } }));
    vi.stubGlobal('fetch', refresh);
    const router = createMemoryRouter([{ path: '*', loader: () => ({ ...missionControlFixture, asOf }), element: <Home /> }], { initialEntries: ['/agents/new?context=local&project=one'] });
    render(<RouterProvider router={router} />);
    await screen.findByText('Define a custom agent');
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Unsaved operator input' } });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Refresh status' })).toHaveProperty('disabled', false));
    fireEvent.click(screen.getByRole('button', { name: 'Refresh status' }));
    expect((await screen.findByRole('alert')).textContent).toContain('previous snapshot and your edits are kept');
    expect(screen.getByLabelText('Name')).toHaveProperty('value', 'Unsaved operator input');
    expect(document.querySelector('time')?.dateTime).toBe(new Date(asOf).toISOString());
    expect(refresh.mock.calls[0][0]).toContain('context=local&project=one');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Refresh status' })).toHaveProperty('disabled', false));
    fireEvent.click(screen.getByRole('button', { name: 'Refresh status' }));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(screen.getByLabelText('Name')).toHaveProperty('value', 'Unsaved operator input');
  });

  it.each([
    () => Promise.resolve(new Response('Unavailable', { status: 503 })),
    () => Promise.resolve(Response.json({ ok: true, data: { asOf: null } })),
  ])('keeps the editor when refresh fails or returns invalid data', async response => {
    vi.stubGlobal('fetch', vi.fn(response));
    const router = createMemoryRouter([{ path: '*', loader: () => missionControlFixture, element: <Home /> }], { initialEntries: ['/agents/new'] });
    render(<RouterProvider router={router} />);
    await screen.findByText('Define a custom agent');
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Keep draft' } });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Refresh status' })).toHaveProperty('disabled', false));
    fireEvent.click(screen.getByRole('button', { name: 'Refresh status' }));
    await screen.findByRole('alert');
    expect(screen.getByLabelText('Name')).toHaveProperty('value', 'Keep draft');
  });

  it('ignores a late refresh after navigation and prevents duplicate requests', async () => {
    let finish!: (response: Response) => void;
    const refresh = vi.fn(() => new Promise<Response>(resolve => { finish = resolve; }));
    vi.stubGlobal('fetch', refresh);
    const router = createMemoryRouter([{ path: '*', loader: () => ({ ...missionControlFixture, asOf: 1000 }), element: <Home /> }], { initialEntries: ['/agents/new'] });
    render(<RouterProvider router={router} />);
    await screen.findByText('Define a custom agent');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Refresh status' })).toHaveProperty('disabled', false));
    fireEvent.click(screen.getByRole('button', { name: 'Refresh status' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Refreshing status…' }));
    expect(refresh).toHaveBeenCalledOnce();
    await router.navigate('/agents');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Refresh status' })).toBeTruthy());
    expect((refresh.mock.calls[0] as unknown as [string, RequestInit])[1].signal?.aborted).toBe(true);
    finish(Response.json({ ok: true, data: { ...missionControlFixture, asOf: 999999 } }));
    await waitFor(() => expect(document.querySelector('time')?.dateTime).toBe(new Date(1000).toISOString()));
  });

  it("declares metadata and composes loader data with URL filters", async () => {
    expect(meta()).toContainEqual({ title: "Mission Control · Senderos Studio" });
    const data = {
      ...missionControlFixture,
      executionContexts: [], projects: [], goals: [], runs: [], attempts: [], agents: [], transitions: [], senderoGraphs: [], events: [],
      queue: { reviews: [], activeRuns: [], failedAttempts: [], staleAttempts: [], dispatchable: [], blockedGoals: [] },
      runtime: { database: { endpoint: "Local database", urlEnv: "URL", authTokenEnv: "TOKEN", remote: false } },
    };
    const router = createMemoryRouter([{ path: "*", loader: () => data, element: <Home /> }], { initialEntries: ["/goals?context=context&project=project"] });
    render(<RouterProvider router={router} />);
    expect(await screen.findByText("No goals in this scope")).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Execution context" })).toHaveProperty("value", "");
    expect(screen.getByRole("combobox", { name: "Project" })).toHaveProperty("value", "");
  });
  it.each([false, true])("keeps authoring visible with actionable feedback after a %s action", async (ok) => {
    const router = createMemoryRouter([{ path: '*', loader: () => missionControlFixture, action: () => ({ ok, intent: 'create-agent', message: ok ? 'Saved successfully' : 'Name already exists' }), element: <Home /> }], { initialEntries: ['/agents/new'] });
    render(<RouterProvider router={router} />);
    await screen.findByText('Define a custom agent');
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Researcher' } });
    fireEvent.change(screen.getByLabelText('Slug'), { target: { value: 'researcher' } });
    fireEvent.change(screen.getByLabelText('Instructions'), { target: { value: 'Research' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create agent' }));
    await waitFor(() => expect(screen.getByRole(ok ? 'status' : 'alert').textContent).toBe(ok ? 'Saved successfully' : 'Name already exists'));
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Researcher');
  });

});


describe('draft save transport recovery', () => {
  it.each(['replace-sendero-draft', 'update-goal', 'update-project', 'register-context', 'register-project', 'evidence', 'review', 'set-activation-budget', 'set-retry-budget'])('keeps %s edits mounted when a save response is lost without claiming it was not applied', async (intent) => {
    const form = new FormData(); form.set('intent', intent);
    const result = await clientAction({ url: new URL('http://localhost/senderos/draft'), params: {}, pattern: '*', context: new RouterContextProvider(), request: new Request('http://localhost/senderos/draft', { method: 'POST', body: form }),
      serverAction: async () => { throw new TypeError('Failed to fetch'); },
    } as Parameters<typeof clientAction>[0]);
    expect(result).toMatchObject({ ok: false, intent, transportFailure: true });
    expect(result).toHaveProperty('message', expect.stringContaining('could not confirm'));
    expect(result).toHaveProperty('message', expect.stringContaining('may have reached'));
    if (['update-project', 'register-context', 'register-project', 'evidence', 'review', 'set-activation-budget', 'set-retry-budget'].includes(intent)) {
      expect(result).toHaveProperty('message', expect.stringContaining('before submitting again'));
      expect(result.message).not.toContain('revision checks');
    }
    expect(shouldRevalidate({ actionResult: result, defaultShouldRevalidate: true } as Parameters<typeof shouldRevalidate>[0])).toBe(false);
    expect(shouldRevalidate({ actionResult: { ok: false }, defaultShouldRevalidate: true } as Parameters<typeof shouldRevalidate>[0])).toBe(true);
  });
  it('does not convert other action failures to graph-save feedback', async () => {
    const form = new FormData(); form.set('intent', 'create-goal');
    await expect(clientAction({ url: new URL('http://localhost/goals/new'), params: {}, pattern: '*', context: new RouterContextProvider(), request: new Request('http://localhost/goals/new', { method: 'POST', body: form }),
      serverAction: async () => { throw new TypeError('Failed to fetch'); },
    } as Parameters<typeof clientAction>[0])).rejects.toThrow('Failed to fetch');
  });
});

describe('registration redirect confirmation', () => {
  it.each(['register-context', 'register-project'])('preserves the successful %s router redirect', async intent => {
    const form = new FormData(); form.set('intent', intent);
    const confirmation = redirect('/settings?context=registered&saved=' + intent);
    await expect(clientAction({ url: new URL('http://localhost/settings'), params: {}, pattern: '*', context: new RouterContextProvider(), request: new Request('http://localhost/settings', { method: 'POST', body: form }),
      serverAction: async () => { throw confirmation; },
    } as Parameters<typeof clientAction>[0])).rejects.toBe(confirmation);
  });
});
