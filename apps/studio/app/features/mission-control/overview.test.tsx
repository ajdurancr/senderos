import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";

import { missionControlFixture } from "../../test-support/mission-control-fixture";
import { MissionControlOverview } from "./overview";
import { parseStudioPath } from "./navigation";

const data = missionControlFixture;

function renderPath(path: string) {
  const [pathname, query = ""] = path.split("?");
  const router = createMemoryRouter([{
    path: "*",
    action: () => null,
    element: <MissionControlOverview data={data} route={parseStudioPath(pathname)} search={new URLSearchParams(query)} />,
  }], { initialEntries: [path] });
  return render(<RouterProvider router={router} />);
}

describe("MissionControlOverview", () => {
  it.each([
    ["/now", "What needs attention now"],
    ["/goals?project=project-1", "Goals"],
    ["/goals/new?project=project-1", "Define the outcome before dispatch."],
    ["/runs/attempts/attempt-1", "Runs & attempts"],
    ["/reviews", "Evidence reviews"],
    ["/agents", "Agents & transitions"],
    ["/events", "Activity & events"],
    ["/settings?project=project-1", "Project & database settings"],
    ["/senderos/sendero-1", "Demo Sendero"],
    ["/canvas/goals/goal-1?plan=true", "Orchestration topology"],
  ])("renders the relevant %s workspace", (path, copy) => {
    renderPath(path);
    expect(screen.getAllByText(copy).length).toBeGreaterThan(0);
  });

  it("renders useful empty states", () => {
    const router = createMemoryRouter([{
      path: "*",
      element: <MissionControlOverview data={{ ...data, senderoGraphs: [] }} route={parseStudioPath("/senderos/missing")} search={new URLSearchParams()} />,
    }]);
    render(<RouterProvider router={router} />);
    expect(screen.getByText("No Senderos available")).toBeTruthy();
  });

  it("renders empty operational views without crashing", () => {
    const empty = {
      ...data,
      projects: [], goals: [], runs: [], attempts: [], agents: [], transitions: [], events: [],
      queue: { reviews: [], activeRuns: [], failedAttempts: [], staleAttempts: [], dispatchable: [], blockedGoals: [] },
    };
    for (const [path, copy] of [["/now?filter=failed", "Queue clear"], ["/runs", "No execution history"], ["/settings", "Shared database"]]) {
      const [pathname, query = ""] = path.split("?");
      const router = createMemoryRouter([{ path: "*", element: <MissionControlOverview data={empty} route={parseStudioPath(pathname)} search={new URLSearchParams(query)} /> }]);
      const view = render(<RouterProvider router={router} />);
      expect(view.container.textContent).toContain(copy);
      view.unmount();
    }
  });
});
