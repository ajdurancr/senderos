import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";

import type { MissionControlData } from "./server";
import { MissionControlOverview } from "./overview";
import { parseStudioPath } from "./navigation";

const timestamp = "2026-09-17T12:00:00.000Z";
const agent = { id: "agent-1", slug: "agent", name: "Agent One", kind: "worker", status: "active", description: "Does work", defaultGoal: "Ship", createdAt: timestamp, updatedAt: timestamp };
const attempt = { id: "attempt-1", runId: "run-1", attemptNumber: 1, agentId: agent.id, transitionId: "edge-1", executionObjective: "Deliver", harness: "codex", externalSessionId: null, resumeCommand: null, heartbeatAt: timestamp, hostEnvironmentName: "host", workingPath: "/tmp/work", workingPathMode: "new", retryFromAttemptId: null, checkpoint: "testing", status: "failed", failureSummary: "Tests failed", statusSnapshotJson: JSON.stringify({ evidence: [{ id: "proof", label: "Test report", kind: "manual" }], review: { status: "changes_requested" } }), startedAt: timestamp, completedAt: timestamp, createdAt: timestamp, updatedAt: timestamp };
const data = {
  executionContexts: [{ id: "context-1", name: "Context One", createdAt: timestamp, updatedAt: timestamp }],
  projects: [{ id: "project-1", executionContextId: "context-1", name: "Project One", githubOwner: "owner", githubRepo: "repo", targetBranch: "main", integrationMode: "github_pr", status: "active", createdAt: timestamp, updatedAt: timestamp }],
  goals: [{ id: "goal-1", projectId: "project-1", title: "Ship feature", kind: "feature", status: "failed", baseTargetBranch: "main", senderoVersionId: "version-1", createdAt: timestamp, updatedAt: timestamp }],
  runs: [{ id: "run-1", goalId: "goal-1", status: "failed", createdAt: timestamp, updatedAt: timestamp }],
  attempts: [attempt],
  agents: [agent],
  transitions: [{ id: "transition-1", sourceAgentId: agent.id, targetAgentId: null, name: "Handoff", description: "Move", transitionObjective: "Deliver", status: "active", createdAt: timestamp, updatedAt: timestamp }],
  senderoGraphs: [{ sendero: { id: "sendero-1", slug: "demo", name: "Demo Sendero", description: "A demo", status: "active" }, version: { id: "version-1", senderoId: "sendero-1", version: 1 }, nodes: [{ id: "node-start", senderoVersionId: "version-1", agentId: null, kind: "start", label: "Start", positionX: 20, positionY: 80 }, { id: "node-agent", senderoVersionId: "version-1", agentId: agent.id, kind: "agent", label: "Agent", positionX: 300, positionY: 80 }, { id: "node-end", senderoVersionId: "version-1", agentId: null, kind: "end", label: "End", positionX: 580, positionY: 80 }], edges: [{ id: "edge-1", senderoVersionId: "version-1", sourceNodeId: "node-agent", targetNodeId: "node-end", name: "Finish", description: "Complete", transitionObjective: "Complete", status: "active" }] }],
  events: [{ id: "event-1", eventType: "attempt.failed", entityType: "attempt", entityId: attempt.id, payload: { reason: "tests" }, createdAt: timestamp }],
  queue: { reviews: [{ attempt }], failedAttempts: [attempt], staleAttempts: [attempt], dispatchable: [{ goalId: "goal-1", transitionId: "edge-1", agentId: agent.id, previousRunId: "run-0" }], blockedGoals: [] },
  runtime: { database: { urlEnv: "SENDEROS_DATABASE_URL", authTokenEnv: "SENDEROS_DATABASE_AUTH_TOKEN", endpoint: "Local libSQL database", remote: false } },
} as unknown as MissionControlData;

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
    } as any;
    for (const [path, copy] of [["/now?filter=failed", "Queue clear"], ["/runs", "No execution history"], ["/settings", "Shared database"]]) {
      const [pathname, query = ""] = path.split("?");
      const router = createMemoryRouter([{ path: "*", element: <MissionControlOverview data={empty} route={parseStudioPath(pathname)} search={new URLSearchParams(query)} /> }]);
      const view = render(<RouterProvider router={router} />);
      expect(view.container.textContent).toContain(copy);
      view.unmount();
    }
  });
});
