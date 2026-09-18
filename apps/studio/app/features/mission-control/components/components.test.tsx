import { fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";

import { AttemptInspector } from "./attempt-inspector";
import { CommandPalette } from "./command-palette";
import { ContextualInspector } from "./contextual-inspector";
import { GoalList } from "./goal-list";
import { OrchestrationCanvas } from "./orchestration-canvas";
import { QueueMetrics } from "./queue-metrics";
import { DispatchTray } from "./dispatch-tray";
import { AgentsView, AttentionView, EventsView, GoalsView, ReviewsView, RunsView, SettingsView } from "./workspace-views";

const now = "2026-09-17T12:00:00Z";
const agent = { id: "agent", name: "Worker", description: "Works", kind: "worker", status: "active" };
const goal = { id: "goal", projectId: "project", title: "Test goal", kind: "feature", baseTargetBranch: "main", senderoVersionId: "version", status: "draft", createdAt: now, updatedAt: now };
const run = { id: "run", goalId: goal.id, status: "running", createdAt: now, updatedAt: now };
const attempt = { id: "attempt", runId: run.id, attemptNumber: 1, agentId: agent.id, transitionId: "edge", executionObjective: "Execute", harness: "codex", checkpoint: null, heartbeatAt: now, workingPath: null, retryFromAttemptId: null, status: "running", statusSnapshotJson: JSON.stringify({ evidence: [{ id: "e", label: "Proof", kind: "manual" }], review: { status: "approved" } }), createdAt: now, updatedAt: now };
const graph = { sendero: { id: "sendero", name: "Trail", description: "Trail description", status: "active" }, version: { id: "version", version: 1 }, nodes: [{ id: "start", kind: "start", label: "Start", agentId: null, positionX: 20, positionY: 60 }, { id: "worker", kind: "agent", label: "Worker", agentId: agent.id, positionX: 300, positionY: 60 }, { id: "end", kind: "end", label: "End", agentId: null, positionX: 580, positionY: 60 }], edges: [{ id: "edge", sourceNodeId: "worker", targetNodeId: "end", name: "Finish", description: "Done", transitionObjective: "Done", status: "active" }] };
const data = { projects: [{ id: "project" }], goals: [goal], runs: [run], attempts: [attempt], agents: [agent], transitions: [], senderoGraphs: [graph], events: [], queue: { reviews: [], dispatchable: [{ goalId: goal.id, transitionId: "edge", agentId: agent.id }], failedAttempts: [], staleAttempts: [], blockedGoals: [] } } as any;

function inRouter(element: React.ReactNode) {
  const router = createMemoryRouter([{ path: "*", action: () => null, element }]);
  return render(<RouterProvider router={router} />);
}

describe("mission-control components", () => {
  it("renders legacy summary components and all goal actions", () => {
    inRouter(<><QueueMetrics queue={data.queue} /><GoalList goals={[goal, { ...goal, id: "failed", status: "failed" }, { ...goal, id: "active", status: "active" }] as any} runs={[run] as any} /><AttemptInspector attempts={[attempt] as any} goals={[goal] as any} runs={[run] as any} /></>);
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
    inRouter(<CommandPalette data={data} projectId="project" />);
    fireEvent.click(screen.getByText("Search or run a command"));
    const input = screen.getByPlaceholderText("Find a goal, attempt, or action…");
    fireEvent.change(input, { target: { value: "nothing-here" } });
    expect(screen.getByText("Nothing matches that query.")).toBeTruthy();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("renders and resets an interactive Sendero canvas", () => {
    inRouter(<OrchestrationCanvas data={data} projectId="project" goalId="goal" />);
    expect(screen.getAllByText("Trail").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText("Auto layout"));
    const node = screen.getByLabelText("Inspect agent Worker");
    fireEvent.pointerDown(node, { button: 1, pointerId: 1 });
    Object.assign(node, { setPointerCapture: () => undefined });
    fireEvent.pointerDown(node, { button: 0, pointerId: 2, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(node, { pointerId: 2, clientX: 120, clientY: 125 });
    fireEvent.pointerUp(node, { pointerId: 2 });
    fireEvent.click(node);
  });

  it("renders the canvas empty state", () => {
    inRouter(<OrchestrationCanvas data={{ ...data, senderoGraphs: [] }} />);
    expect(screen.getByText("The shared database has no published Sendero definition.")).toBeTruthy();
  });

  it("covers contextual inspector selections and terminal empty evidence", () => {
    const terminalAttempt = { ...attempt, status: "succeeded", statusSnapshotJson: "{}", checkpoint: "done", workingPath: "/tmp/done" };
    const detailed = { ...data, attempts: [terminalAttempt], transitions: [{ id: "legacy", sourceAgentId: agent.id, name: "Legacy", transitionObjective: "Hand off" }], events: [{ id: "event", eventType: "goal.updated", entityId: goal.id, createdAt: now }] };
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

  it("renders fallback and empty branches across operational views", () => {
    const orphan = { ...attempt, id: "orphan", runId: "missing", failureSummary: undefined, heartbeatAt: null, retryFromAttemptId: "prior", statusSnapshotJson: JSON.stringify({ evidence: [{ id: "e", label: "Evidence", kind: "manual" }] }) };
    const fallback = {
      ...data,
      executionContexts: [], projects: [{ id: "settings", name: "Settings project", githubOwner: "owner", githubRepo: "repo", targetBranch: "main", integrationMode: "github_pr", status: "active" }], goals: [], runs: [], attempts: [orphan], agents: [{ ...agent, description: "", defaultGoal: "" }], events: [{ id: "event", eventType: "run.started", entityType: "run", entityId: "missing", payload: {}, createdAt: now }],
      queue: { reviews: [{ attempt: orphan }], activeRuns: [], failedAttempts: [orphan], staleAttempts: [orphan], dispatchable: [{ goalId: "missing", transitionId: "missing", agentId: "missing" }], blockedGoals: [] },
      runtime: { database: { endpoint: "db.example.test", remote: true, urlEnv: "URL", authTokenEnv: "TOKEN" } },
    } as any;
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
