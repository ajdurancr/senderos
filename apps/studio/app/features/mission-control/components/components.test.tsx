import { fireEvent, render, screen, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";

import { AttemptInspector } from "./attempt-inspector";
import { CommandPalette } from "./command-palette";
import { ContextualInspector } from "./contextual-inspector";
import { GoalList } from "./goal-list";
import { OrchestrationCanvas } from "./orchestration-canvas";
import { QueueMetrics } from "./queue-metrics";
import { DispatchTray } from "./dispatch-tray";
import { SenderoInspector } from "./sendero-inspector";
import { AgentsView, AttentionView, EventsView, GoalsView, ReviewsView, RunsView, SettingsView } from "./workspace-views";
import { fixtureTimestamp, missionControlFixture } from "../../../test-support/mission-control-fixture";
import type { MissionControlData } from "../server";

const now = fixtureTimestamp;
const data = missionControlFixture;
const agent = data.agents[0]!;
const goal = data.goals[0]!;
const run = data.runs[0]!;
const attempt = data.attempts[0]!;

function inRouter(element: React.ReactNode) {
  const router = createMemoryRouter([{ path: "*", action: () => null, element }]);
  return render(<RouterProvider router={router} />);
}

describe("mission-control components", () => {
  it("renders legacy summary components and all goal actions", () => {
    inRouter(<><QueueMetrics queue={data.queue} /><GoalList goals={[{ ...goal, status: "draft" }, { ...goal, id: "failed", status: "failed" }, { ...goal, id: "active", status: "active" }]} runs={[{ ...run, status: "executing" }]} /><AttemptInspector attempts={[{ ...attempt, status: "running", statusSnapshotJson: JSON.stringify({ evidence: [{ id: "e", label: "Proof", kind: "manual" }], review: { status: "approved" } }) }]} goals={[goal]} runs={[run]} /></>);
    expect(screen.getByText("Needs review")).toBeTruthy();
    expect(screen.getByText("Start goal")).toBeTruthy();
    expect(screen.getByText("Retry")).toBeTruthy();
    expect(screen.getByText("Stop execution")).toBeTruthy();
    expect(screen.getByText("Review: approved")).toBeTruthy();
  });

  it("renders the no-active-attempt state", () => {
    inRouter(<AttemptInspector attempts={[]} goals={[]} runs={[]} />);
    expect(screen.getByText("No active execution.")).toBeTruthy();
  });

  it("opens, filters, and closes the command palette from mouse and keyboard", () => {
    inRouter(<CommandPalette data={data} projectId={goal.projectId} />);
    fireEvent.click(screen.getByText("Search or run a command"));
    const input = screen.getByPlaceholderText("Find a goal, attempt, or action…");
    fireEvent.change(input, { target: { value: "nothing-here" } });
    expect(screen.getByText("Nothing matches that query.")).toBeTruthy();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.mouseDown(screen.getByRole("dialog"));
    expect(screen.getByRole("dialog")).toBeTruthy();
    const backdrop = screen.getByRole("dialog").parentElement;
    expect(backdrop).not.toBeNull();
    if (backdrop) fireEvent.mouseDown(backdrop);
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByText("Search or run a command"));
    fireEvent.click(screen.getByText("Esc"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("lists attempts whose run or goal is no longer present", () => {
    const view = inRouter(<CommandPalette data={{ ...data, goals: [], runs: [] }} />);
    const rendered = within(view.container);
    fireEvent.click(rendered.getByText("Search or run a command"));
    expect(rendered.getByText(`Attempt ${attempt.id}`)).toBeTruthy();
  });

  it("renders and resets an interactive Sendero canvas", () => {
    inRouter(<OrchestrationCanvas data={data} projectId={goal.projectId} goalId={goal.id} />);
    expect(screen.getAllByText("Demo Sendero").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText("Auto layout"));
    const node = screen.getByLabelText("Inspect agent Agent One");
    fireEvent.pointerDown(node, { button: 1, pointerId: 1 });
    Object.assign(node, { setPointerCapture: () => undefined });
    fireEvent.pointerDown(node, { button: 0, pointerId: 2, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(node, { pointerId: 2, clientX: 120, clientY: 125 });
    fireEvent.pointerUp(node, { pointerId: 2 });
    fireEvent.click(node);
  });

  it("renders the canvas empty state", () => {
    inRouter(<>
      <OrchestrationCanvas data={{ ...data, senderoGraphs: [] }} />
      <OrchestrationCanvas
        data={{ ...data, goals: [], runs: [], attempts: [] }}
        senderoId={data.senderoGraphs[0]!.sendero.id}
      />
    </>);
    expect(screen.getByText("The shared database has no published Sendero definition.")).toBeTruthy();
    expect(screen.getByText(/DEFINITION/)).toBeTruthy();
  });

  it("covers contextual inspector selections and terminal empty evidence", () => {
    const terminalAttempt: MissionControlData["attempts"][number] = { ...attempt, status: "succeeded", statusSnapshotJson: "{}", checkpoint: "done", workingPath: "/tmp/done" };
    const detailed: MissionControlData = { ...data, attempts: [terminalAttempt], transitions: [{ ...data.transitions[0]!, id: "legacy", sourceAgentId: agent.id, name: "Legacy", transitionObjective: "Hand off" }], events: [{ ...data.events[0]!, id: "event", eventType: "goal.updated", entityId: goal.id, createdAt: now }] };
    inRouter(<>
      <ContextualInspector data={detailed} />
      <ContextualInspector data={detailed} goalId={goal.id} />
      <ContextualInspector data={detailed} goalId={goal.id} agentId={agent.id} />
      <ContextualInspector data={detailed} goalId={goal.id} attemptId={terminalAttempt.id} />
      <ContextualInspector data={detailed} goalId={goal.id} transitionId="legacy" />
    </>);
    expect(screen.getAllByText("No evidence recorded for this attempt.").length).toBeGreaterThan(0);
    expect(screen.getByText("Agent inspector")).toBeTruthy();
    expect(screen.getByText("Sendero transition")).toBeTruthy();
  });

  it("renders contextual inspector fallbacks before an execution exists", () => {
    const undispatched: MissionControlData = {
      ...data,
      agents: [],
      attempts: [],
      events: [],
      runs: [],
      senderoGraphs: [],
      transitions: [],
    };
    inRouter(<>
      <ContextualInspector data={undispatched} goalId={goal.id} />
      <ContextualInspector data={undispatched} goalId={goal.id} agentId="missing-agent" />
      <ContextualInspector data={undispatched} goalId={goal.id} transitionId="missing-transition" />
    </>);
    expect(screen.getAllByText("Not dispatched").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Not selected").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Waiting for plan").length).toBeGreaterThan(0);
  });

  it("renders Sendero definition, node, edge, and missing selections", () => {
    const graph = data.senderoGraphs[0]!;
    const node = graph.nodes.find((item) => item.agentId)!;
    const edge = graph.edges[0]!;
    inRouter(<>
      <SenderoInspector data={data} senderoId="missing" />
      <SenderoInspector data={data} senderoId={graph.sendero.id} />
      <SenderoInspector data={data} senderoId={graph.sendero.id} nodeId={node.id} />
      <SenderoInspector data={data} senderoId={graph.sendero.id} edgeId={edge.id} />
    </>);
    expect(screen.getByText("Sendero definition")).toBeTruthy();
    expect(screen.getAllByText("Agent ID").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Arc ID").length).toBeGreaterThan(0);
  });

  it("renders plural retry dispatch plans with resolved entities", () => {
    const dispatchable = {
      goalId: goal.id,
      transitionId: data.transitions[0]!.id,
      agentId: agent.id,
      previousRunId: run.id,
    };
    inRouter(<DispatchTray data={{
      ...data,
      queue: { ...data.queue, dispatchable: [dispatchable, { ...dispatchable, transitionId: "second" }] },
    }} />);
    expect(screen.getByText("2 proposed actions")).toBeTruthy();
    expect(screen.getAllByText("retry")).toHaveLength(2);
  });

  it("renders fallback and empty branches across operational views", () => {
    const orphan: MissionControlData["attempts"][number] = { ...attempt, id: "orphan", runId: "missing", failureSummary: null, heartbeatAt: null, retryFromAttemptId: "prior", statusSnapshotJson: JSON.stringify({ evidence: [{ id: "e", label: "Evidence", kind: "manual" }] }) };
    const fallback: MissionControlData = {
      ...data,
      executionContexts: [], projects: [{ ...data.projects[0]!, id: "settings", name: "Settings project" }], goals: [], runs: [], attempts: [orphan], agents: [{ ...agent, description: "", defaultGoal: "" }], events: [{ ...data.events[0]!, id: "event", eventType: "run.started", entityType: "run", entityId: "missing", payload: {}, createdAt: now }],
      queue: { reviews: [{ attempt: orphan, review: { status: "pending" } }], activeRuns: [], failedAttempts: [orphan], staleAttempts: [orphan], dispatchable: [{ goalId: "missing", transitionId: "missing", agentId: "missing", previousRunId: null }], blockedGoals: [] },
      runtime: { database: { endpoint: "db.example.test", remote: true, urlEnv: "URL", authTokenEnv: "TOKEN" } },
    };
    inRouter(<>
      <AttentionView data={fallback} />
      <GoalsView data={fallback} create={false} />
      <RunsView data={fallback} />
      <ReviewsView data={fallback} />
      <AgentsView data={fallback} />
      <EventsView data={fallback} />
      <SettingsView data={fallback} />
      <DispatchTray data={{ ...fallback, queue: { ...fallback.queue, dispatchable: [] } }} />
    </>);
    expect(screen.getAllByText("Project & database settings").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Execution failed without a summary.").length).toBeGreaterThan(0);
  });
});
