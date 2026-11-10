import { cleanup, render, screen, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { missionControlFixture as fixture } from "../../../test-support/mission-control-fixture";
import { AttentionView } from "./workspace-views";
import { AttentionRail } from "./attention-rail";
import type { MissionControlData } from "../server";

afterEach(cleanup);
const blocked = { goalId: "goal-1", activationId: "blocked-visit", nodeId: "node-agent", state: "blocked" as const, reason: "AGENT_UNAVAILABLE", nextAction: "Enable the activation agent or cancel the goal" };
const data = { ...fixture, historyGraphs: fixture.senderoGraphs, goals: [{ ...fixture.goals[0]!, status: "active" as const }], decisions: [{ ...blocked, activations: [blocked] }] };
function show(input: MissionControlData = data, filter?: string) {
  return render(<RouterProvider router={createMemoryRouter([{ path: "*", element: <><AttentionView data={input} projectId="project-1" filter={filter} /><AttentionRail data={input} projectId="project-1" /></> }], { initialEntries: ["/now?context=context-1&project=project-1"] })} />);
}

describe("blocked-goal attention", () => {
  it("shows an active goal's blocker with exact activation and agent links, scope, and count", () => {
    show(data, "blocked");
    const card = within(screen.getByRole("article", { name: "Goal blockers: Ship feature" }));
    expect(card.getByRole("heading", { name: "Agent · Agent unavailable" })).toBeTruthy();
    expect(card.getByText("active")).toBeTruthy();
    expect(card.getByText(/Other branches may still be ready or running/)).toBeTruthy();
    expect(card.getByRole("link", { name: "Inspect activation" }).getAttribute("href")).toBe("/projects/project-1/canvas/goals/goal-1/nodes/node-agent?context=context-1&project=project-1");
    expect(card.getByRole("link", { name: "Manage agent" }).getAttribute("href")).toBe("/agents/agent-1?context=context-1&project=project-1");
    expect(screen.getByRole("link", { name: "Goal blockers: 1" }).getAttribute("href")).toBe("/projects/project-1/now?filter=blocked&context=context-1&project=project-1");
    expect(screen.getByRole("link", { name: "Goal blockers (1)" }).getAttribute("aria-current")).toBe("page");
    expect(screen.queryByRole("heading", { name: "Queue clear" })).toBeNull();
  });

  it("explains goal-level errors when pinned nodes and scope metadata are missing", () => {
    const { container } = show({ ...data, projects: [], historyGraphs: [], decisions: [{ ...blocked, nodeId: undefined, reason: "<b>UNKNOWN</b>", nextAction: "inspect_recorded_state", activations: [] }] }, "blocked");
    expect(screen.getByRole("heading", { name: "<b>UNKNOWN</b>" })).toBeTruthy();
    expect(screen.getByText(/inspect recorded state/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Inspect goal" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Manage agent" })).toBeNull();
    expect(container.querySelector("b")).toBeNull();
  });

  it("links an expired lease to its exact attempt without suggesting that expiry stops the worker", () => {
    const decision = { ...blocked, reason: "lease_expired", nextAction: "reconcile", attemptId: "attempt-1" };
    show({ ...data, decisions: [{ ...decision, activations: [decision] }] }, "blocked");
    expect(screen.getByRole("link", { name: "Inspect activation" }).getAttribute("href")).toContain("/nodes/node-agent/attempts/attempt-1?");
    expect(screen.getByText(/An expired lease does not prove the process stopped/)).toBeTruthy();
  });

  it("keeps repeated blocked visits in one card while counting the goal once", () => {
    const second = { ...blocked, activationId: "second-visit", reason: "retry_limit_reached", nextAction: "increase_retry_budget" };
    show({ ...data, decisions: [{ ...blocked, activations: [blocked, second] }] });
    expect(screen.getAllByRole("article", { name: "Goal blockers: Ship feature" })).toHaveLength(1);
    expect(screen.getByText(/2 issues need attention/)).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Agent · Attempt budget reached" })).toBeTruthy();
    expect(screen.getAllByRole("link", { name: "Inspect activation" })).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Goal blockers: 1" })).toBeTruthy();
  });

  it("keeps filtered empty states distinct from a clear global queue", () => {
    show({ ...data, decisions: [] }, "blocked");
    expect(screen.getByRole("heading", { name: "No goal blockers" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Queue clear" })).toBeNull();
    expect(screen.getByRole("link", { name: "All attention" }).getAttribute("href")).toBe("/projects/project-1/now?context=context-1&project=project-1");
  });

  it("provides a recovery link for an unknown category", () => {
    show(data, "not-a-filter");
    expect(screen.getByRole("heading", { name: "Unknown attention filter" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Show all attention" })).toBeTruthy();
    expect(screen.queryByRole("article")).toBeNull();
  });
});
