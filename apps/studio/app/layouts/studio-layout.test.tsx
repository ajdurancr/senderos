import { fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";

import { StudioLayout } from "./studio-layout";
import { parseStudioPath } from "../features/mission-control/navigation";

const data = {
  executionContexts: [{ id: "context", name: "Context" }],
  projects: [{ id: "project", executionContextId: "context", name: "Project", targetBranch: "main" }],
  senderoGraphs: [{ sendero: { id: "sendero" } }],
  queue: { reviews: [{}], dispatchable: [], activeRuns: [], failedAttempts: [], staleAttempts: [], blockedGoals: [] },
  runtime: { database: { endpoint: "Local database" } },
  goals: [], attempts: [], runs: [],
} as any;

describe("StudioLayout", () => {
  it("renders navigation, pending state, and persists hierarchical filters", () => {
    const router = createMemoryRouter([{
      path: "*",
      element: <StudioLayout data={data} pending route={parseStudioPath("/goals")} search={new URLSearchParams()}><p>Content</p></StudioLayout>,
    }], { initialEntries: ["/goals"] });
    render(<RouterProvider router={router} />);
    expect(screen.getByText("Applying change…")).toBeTruthy();
    expect(screen.getByText("Content")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Execution context"), { target: { value: "context" } });
    expect(router.state.location.search).toContain("context=context");
  });

  it("renders the shared Senderos header", () => {
    const router = createMemoryRouter([{ path: "*", element: <StudioLayout data={data} pending={false} route={parseStudioPath("/senderos/sendero")} search={new URLSearchParams()}><span>Sendero</span></StudioLayout> }]);
    render(<RouterProvider router={router} />);
    expect(screen.getByText("Shared Senderos")).toBeTruthy();
    expect(screen.getAllByText("Database connected").length).toBeGreaterThan(0);
  });
});
