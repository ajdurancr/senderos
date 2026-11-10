import { cleanup, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it } from "vitest";

import { missionControlFixture } from "../../test-support/mission-control-fixture";
import { MissionControlOverview } from "./overview";
import { parseStudioPath } from "./navigation";

const data = missionControlFixture;
afterEach(cleanup);

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
    ["/settings?project=project-1", "Shared database"],
    ["/senderos/sendero-1", "Demo Sendero"],
    ["/projects/project-1/canvas/goals/goal-1?plan=true", "Workflow progress"],
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

it("keeps global attention counts linked to global records instead of the first rendered goal's project", () => {
  renderPath("/canvas?context=context-1");
  const rail = screen.getByRole("complementary", { name: "Needs attention" });
  const links = rail.querySelectorAll("a");
  expect(links).toHaveLength(4);
  for (const link of links) {
    const href = new URL(link.href);
    expect(href.pathname).toBe("/now");
    expect(href.searchParams.get("context")).toBe("context-1");
    expect(href.searchParams.has("project")).toBe(false);
    expect(href.searchParams.get("filter")).toMatch(/^(review|failed|stale|dispatchable)$/);
  }
});

it("keeps project attention summaries linked to that project", () => {
  renderPath("/projects/project-1/canvas?context=context-1");
  for (const link of screen.getByRole("complementary", { name: "Needs attention" }).querySelectorAll("a")) {
    const href = new URL(link.href);
    expect(href.pathname).toBe("/projects/project-1/now");
    expect(href.searchParams.get("context")).toBe("context-1");
    expect(href.searchParams.get("project")).toBe("project-1");
  }
});

it("shows an in-scope goal even when the first project has no goals", () => {
  const fixture = { ...data, projects: [{ ...data.projects[0]!, id: "empty-project", name: "Empty project" }, ...data.projects] };
  const { container } = render(<RouterProvider router={createMemoryRouter([{ path: "*", element: <MissionControlOverview data={fixture} route={parseStudioPath("/canvas")} search={new URLSearchParams()} /> }], { initialEntries: ["/canvas"] })} />);
  expect(screen.getByRole("heading", { name: "Workflow progress" })).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "No goal selected" })).toBeNull();
  expect(screen.getByRole("heading", { name: "Ship feature" })).toBeTruthy();
  expect(container.querySelector('.context-inspector a[aria-label="Back to project"]')?.getAttribute("href")).toBe("/projects/project-1/canvas");
});

it("leaves an empty scope's requested dispatch plan visible and dismissible", () => {
  const fixture = { ...data, goals: [], runs: [], attempts: [], queue: { ...data.queue, dispatchable: [] } };
  const path = "/canvas?context=context-1&plan=true";
  render(<RouterProvider router={createMemoryRouter([{ path: "*", element: <MissionControlOverview data={fixture} route={parseStudioPath("/canvas")} search={new URLSearchParams("context=context-1&plan=true")} /> }], { initialEntries: [path] })} />);
  expect(screen.getByRole("heading", { name: "No goal selected" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "No activations ready" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Dispatch all" })).toHaveProperty("disabled", true);
  expect(screen.getByRole("link", { name: "Close dispatch plan" }).getAttribute("href")).toBe("/canvas?context=context-1");
});
