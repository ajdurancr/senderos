import { expect, test } from "vitest";

import { missionControlFixture } from "../../test-support/mission-control-fixture";
import { filterMissionControlData } from "./scope-filters";
import type { MissionControlData } from "./server";

test("filters Studio records by execution context and project", () => {
  const contextA = { ...missionControlFixture.executionContexts[0]!, id: "context-a", name: "A" };
  const contextB = { ...contextA, id: "context-b", name: "B" };
  const projectA = { ...missionControlFixture.projects[0]!, id: "project-a", executionContextId: contextA.id };
  const projectB = { ...projectA, id: "project-b", executionContextId: contextB.id };
  const goalA = { ...missionControlFixture.goals[0]!, id: "goal-a", projectId: projectA.id };
  const goalB = { ...goalA, id: "goal-b", projectId: projectB.id };
  const runA = { ...missionControlFixture.runs[0]!, id: "run-a", goalId: goalA.id };
  const runB = { ...runA, id: "run-b", goalId: goalB.id };
  const attemptA = { ...missionControlFixture.attempts[0]!, id: "attempt-a", runId: runA.id };
  const attemptB = { ...attemptA, id: "attempt-b", runId: runB.id };
  const eventA = { ...missionControlFixture.events[0]!, id: "event-a", entityId: goalA.id };
  const eventB = { ...eventA, id: "event-b", entityId: goalB.id };
  const data: MissionControlData = {
    ...missionControlFixture,
    executionContexts: [contextA, contextB],
    projects: [projectA, projectB],
    goals: [goalA, goalB],
    runs: [runA, runB],
    attempts: [attemptA, attemptB],
    events: [eventA, eventB],
    queue: {
      ...missionControlFixture.queue,
      activeRuns: [runA, runB],
      failedAttempts: [attemptA, attemptB],
      staleAttempts: [attemptA, attemptB],
      reviews: [
        { attempt: attemptA, review: { status: "pending" } },
        { attempt: attemptB, review: { status: "pending" } },
      ],
      dispatchable: [
        { goalId: goalA.id, transitionId: "edge-a", agentId: "agent-a", previousRunId: null },
        { goalId: goalB.id, transitionId: "edge-b", agentId: "agent-b", previousRunId: null },
      ],
    },
  };

  const filtered = filterMissionControlData(data, contextA.id);
  expect(filtered.projects.map((item) => item.id)).toEqual([projectA.id]);
  expect(filtered.goals.map((item) => item.id)).toEqual([goalA.id]);
  expect(filtered.runs.map((item) => item.id)).toEqual([runA.id]);
  expect(filtered.attempts.map((item) => item.id)).toEqual([attemptA.id]);
  expect(filtered.events.map((item) => item.id)).toEqual([eventA.id]);
  expect(filtered.queue.activeRuns).toHaveLength(1);
  expect(filtered.queue.failedAttempts).toHaveLength(1);
  expect(filtered.queue.staleAttempts).toHaveLength(1);
  expect(filtered.queue.reviews).toHaveLength(1);
  expect(filtered.queue.dispatchable).toHaveLength(1);

  expect(filterMissionControlData(data).projects).toHaveLength(2);
  expect(filterMissionControlData(data, undefined, projectB.id).projects.map((item) => item.id)).toEqual([projectB.id]);
});
