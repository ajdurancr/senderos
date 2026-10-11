import { afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";

import { missionControlFixture } from "../test-support/mission-control-fixture";

afterEach(cleanup);

import Home, { meta } from "./home";

describe("home route", () => {
  it("declares metadata and composes loader data with URL filters", async () => {
    expect(meta()).toContainEqual({ title: "Mission Control · Senderos Studio" });
    const data = {
      executionContexts: [], projects: [], goals: [], runs: [], attempts: [], agents: [], transitions: [], senderoGraphs: [], events: [],
      queue: { reviews: [], activeRuns: [], failedAttempts: [], staleAttempts: [], dispatchable: [], blockedGoals: [] },
      runtime: { database: { endpoint: "Local database", urlEnv: "URL", authTokenEnv: "TOKEN", remote: false } },
    };
    const router = createMemoryRouter([{ path: "*", loader: () => data, element: <Home /> }], { initialEntries: ["/goals?context=context&project=project"] });
    render(<RouterProvider router={router} />);
    expect(await screen.findByText("No goals in this scope")).toBeTruthy();
    expect(screen.getByText("All execution contexts")).toBeTruthy();
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
