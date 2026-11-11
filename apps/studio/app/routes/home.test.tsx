import { afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterContextProvider, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";

import { missionControlFixture } from "../test-support/mission-control-fixture";

afterEach(cleanup);

import Home, { meta, clientAction, shouldRevalidate } from "./home";

describe("home route", () => {
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
  it.each(['replace-sendero-draft', 'update-goal'])('keeps %s edits mounted when a save response is lost without claiming it was not applied', async (intent) => {
    const form = new FormData(); form.set('intent', intent);
    const result = await clientAction({ url: new URL('http://localhost/senderos/draft'), params: {}, pattern: '*', context: new RouterContextProvider(), request: new Request('http://localhost/senderos/draft', { method: 'POST', body: form }),
      serverAction: async () => { throw new TypeError('Failed to fetch'); },
    } as Parameters<typeof clientAction>[0]);
    expect(result).toMatchObject({ ok: false, intent, transportFailure: true });
    expect(result).toHaveProperty('message', expect.stringContaining('could not confirm'));
    expect(result).toHaveProperty('message', expect.stringContaining('may have reached'));
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
