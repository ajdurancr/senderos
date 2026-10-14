import { cleanup, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { MissionControlOverview } from "../overview";
import { parseStudioPath } from "../navigation";
import { ContextualInspector } from "./contextual-inspector";
import { SenderoInspector } from "./sendero-inspector";
import { AgentAuthoring } from "./agent-authoring";
import { missionControlFixture as fixture } from "../../../test-support/mission-control-fixture";

const data = { ...fixture, historyGraphs: fixture.senderoGraphs };
afterEach(cleanup);
function inRouter(element: React.ReactNode, path = "/now") { return render(<RouterProvider router={createMemoryRouter([{ path: "*", element }], { initialEntries: [path] })} />); }

describe("unavailable entity states", () => {
  it.each([
    ["/not-a-workspace", "Page not found", "Return to Studio", "/now"],
    ["/projects/project-1/canvas/goals/missing", "Goal not found", "View goals", "/goals?project=project-1"],
    ["/senderos/missing", "Sendero not found", "New Sendero", "/senderos/new"],
  ])("renders %s without silently selecting a different entity", (path, heading, action, destination) => {
    inRouter(<MissionControlOverview data={data} route={parseStudioPath(path)} search={new URLSearchParams()} />, path);
    expect(screen.getByRole("heading", { name: heading })).toBeTruthy();
    expect(screen.getByRole("link", { name: action }).getAttribute("href")).toBe(destination);
    expect(screen.queryByRole("heading", { name: "Ship feature" })).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("keeps an explicit missing attempt distinct from empty history and does not show another attempt's proof", () => {
    const path = "/projects/project-1/runs/attempts/missing";
    inRouter(<MissionControlOverview data={data} route={parseStudioPath(path)} search={new URLSearchParams()} />, path);
    expect(screen.getByRole("heading", { name: "Attempt not found" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "No execution history" })).toBeNull();
    expect(screen.queryByText("Test report")).toBeNull();
    expect(screen.queryByRole("link", { name: "Open execution" })).toBeNull();
  });

  it("renders a missing agent editor with a recovery link and no writable form", () => {
    const { container } = inRouter(<AgentAuthoring data={data} agentId="missing" />);
    expect(screen.getByRole("alert").textContent).toBe("This agent is no longer available.");
    expect(screen.getByRole("link", { name: "Back to agents" }).getAttribute("href")).toBe("/agents");
    expect(container.querySelector("form")).toBeNull();
  });

  it.each([
    [{ nodeId: "missing" }, "This workflow node is not part of the goal's pinned definition."],
    [{ agentId: "missing" }, "This agent is unavailable."],
    [{ transitionId: "missing" }, "This transition is not part of the goal's pinned definition."],
    [{ attemptId: "missing" }, "This attempt does not match the selected goal or node, or is no longer available."],
  ])("does not expose an unrelated attempt's controls for unavailable inspector selection %o", (selection, alert) => {
    inRouter(<ContextualInspector data={data} goalId="goal-1" {...selection} />);
    expect(screen.getByRole("alert").textContent).toBe(alert);
    expect(screen.queryByRole("button", { name: "Record evidence" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Record decision" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Request stop" })).toBeNull();
    expect(screen.queryByText("Test report")).toBeNull();
  });

  it.each([
    [{ nodeId: "missing" }, "This node is not part of the selected Sendero version."],
    [{ edgeId: "missing" }, "This transition is not part of the selected Sendero version."],
  ])("does not render the wrong definition form for missing selection %o", (selection, alert) => {
    inRouter(<SenderoInspector data={data} senderoId="sendero-1" {...selection} />);
    expect(screen.getByRole("alert").textContent).toBe(alert);
    expect(screen.queryByRole("button", { name: "Save node" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Save arc" })).toBeNull();
  });
});
