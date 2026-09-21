import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";

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
});
