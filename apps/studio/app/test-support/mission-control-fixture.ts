import type { MissionControlData } from "../features/mission-control/server";

export const fixtureTimestamp = "2026-09-17T12:00:00.000Z";

export const fixtureAttempt: MissionControlData["attempts"][number] = {
  id: "attempt-1", runId: "run-1", attemptNumber: 1, agentId: "agent-1",
  transitionId: "edge-1", status: "failed", executionObjective: "Deliver",
  harness: "codex", externalSessionId: null, resumeCommand: null,
  heartbeatAt: fixtureTimestamp, hostEnvironmentName: "host", workingPath: "/tmp/work",
  workingPathMode: "new", retryFromAttemptId: null, checkpoint: "testing",
  sourceGoalSha: null, failureStep: "test", statusSnapshotJson: JSON.stringify({
    evidence: [{ id: "proof", label: "Test report", kind: "manual" }],
    review: { status: "changes_requested" },
  }), resultJson: "{}", failureSummary: "Tests failed", debugMetaJson: "{}",
  startedAt: fixtureTimestamp, finishedAt: fixtureTimestamp,
  createdAt: fixtureTimestamp, updatedAt: fixtureTimestamp,
};

export const missionControlFixture: MissionControlData = {
  status: {
    projects: { total: 1, unhealthy: 0 },
    openGoals: 1,
    activeRuns: 0,
    activeAttemptIds: [],
    activeGoalIds: ["goal-1"],
    runningRunIds: [],
  },
  executionContexts: [{ id: "context-1", name: "Context One", createdAt: fixtureTimestamp, updatedAt: fixtureTimestamp }],
  projects: [{
    id: "project-1", executionContextId: "context-1", name: "Project One",
    canonicalPath: "/tmp/project-one", githubOwner: "owner", githubRepo: "repo",
    githubRemote: "https://github.com/owner/repo.git", targetBranch: "main",
    status: "healthy", integrationMode: "github_pr", inferredCommandsJson: "{}",
    healthDetailsJson: "{}", createdAt: fixtureTimestamp, updatedAt: fixtureTimestamp,
  }],
  goals: [{
    id: "goal-1", projectId: "project-1", title: "Ship feature", kind: "feature",
    intakeText: "Ship it", specText: "Verified outcome", status: "failed",
    senderoVersionId: "version-1", baseTargetBranch: "main", branchName: null,
    prUrl: null, prNumber: null, createdAt: fixtureTimestamp, updatedAt: fixtureTimestamp,
  }],
  runs: [{
    id: "run-1", goalId: "goal-1", status: "failed", branchName: null,
    baseBranch: "main", maxAttempts: 3, senderoVersionId: "version-1",
    createdAt: fixtureTimestamp, updatedAt: fixtureTimestamp,
  }],
  attempts: [fixtureAttempt],
  agents: [{
    id: "agent-1", slug: "agent", name: "Agent One", description: "Does work",
    kind: "custom", status: "active", definitionFormat: "markdown",
    definitionBody: "Do work", defaultGoal: "Ship", defaultMetaJson: "{}",
    createdAt: fixtureTimestamp, updatedAt: fixtureTimestamp,
  }],
  transitions: [{
    id: "transition-1", sourceAgentId: "agent-1", targetAgentId: null,
    name: "Handoff", description: "Move", status: "active",
    transitionObjective: "Deliver", assignmentMetaJson: "{}",
    createdAt: fixtureTimestamp, updatedAt: fixtureTimestamp,
  }],
  senderoGraphs: [{
    sendero: {
      id: "sendero-1", slug: "demo", name: "Demo Sendero", description: "A demo",
      status: "active", isDefault: true, currentVersion: 1,
      createdAt: fixtureTimestamp, updatedAt: fixtureTimestamp,
    },
    version: {
      id: "version-1", senderoId: "sendero-1", version: 1, status: "published",
      createdAt: fixtureTimestamp,
    },
    nodes: [
      { id: "node-start", senderoVersionId: "version-1", agentId: null, kind: "start", label: "Start", positionX: 20, positionY: 80, createdAt: fixtureTimestamp, updatedAt: fixtureTimestamp },
      { id: "node-agent", senderoVersionId: "version-1", agentId: "agent-1", kind: "agent", label: "Agent", positionX: 300, positionY: 80, createdAt: fixtureTimestamp, updatedAt: fixtureTimestamp },
      { id: "node-end", senderoVersionId: "version-1", agentId: null, kind: "end", label: "End", positionX: 580, positionY: 80, createdAt: fixtureTimestamp, updatedAt: fixtureTimestamp },
    ],
    edges: [{
      id: "edge-1", senderoVersionId: "version-1", sourceNodeId: "node-agent",
      targetNodeId: "node-end", name: "Finish", description: "Complete",
      transitionObjective: "Complete", conditionJson: "{}", status: "active",
      createdAt: fixtureTimestamp, updatedAt: fixtureTimestamp,
    }],
  }],
  events: [{
    id: "event-1", eventType: "attempt.failed", entityType: "attempt",
    entityId: "attempt-1", payload: { reason: "tests" }, createdAt: fixtureTimestamp,
  }],
  queue: {
    reviews: [{ attempt: fixtureAttempt, review: { status: "pending" } }],
    failedAttempts: [fixtureAttempt], staleAttempts: [fixtureAttempt], activeRuns: [],
    dispatchable: [{ goalId: "goal-1", transitionId: "edge-1", agentId: "agent-1", previousRunId: "run-0" }],
    blockedGoals: [],
  },
  runtime: {
    database: {
      urlEnv: "SENDEROS_DATABASE_URL", authTokenEnv: "SENDEROS_DATABASE_AUTH_TOKEN",
      endpoint: "Local libSQL database", remote: false,
    },
  },
};
