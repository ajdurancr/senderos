import { describe, expect, it } from "vitest";

import {
  attemptPath,
  canvasAgentPath,
  canvasEntityPath,
  goalPath,
  parseStudioPath,
  projectPath,
} from "./navigation";

describe("Studio entity routes", () => {
  it("puts project and entity identities in the path", () => {
    expect(projectPath("senderos", "events")).toBe("/projects/senderos/events");
    expect(attemptPath("senderos", "attempt_42")).toBe(
      "/projects/senderos/runs/attempts/attempt_42",
    );
    expect(canvasEntityPath({
      projectId: "senderos",
      goalId: "goal_1",
      transitionId: "transition_2",
      attemptId: "attempt_3",
    })).toBe(
      "/projects/senderos/canvas/goals/goal_1/transitions/transition_2/attempts/attempt_3",
    );
    expect(canvasAgentPath("senderos", "goal_1", "agent_2")).toBe(
      "/projects/senderos/canvas/goals/goal_1/agents/agent_2",
    );
  });

  it("parses deep links back into Studio context", () => {
    expect(parseStudioPath(
      "/projects/senderos/canvas/goals/goal_1/transitions/transition_2/attempts/attempt_3",
    )).toEqual({
      view: "canvas",
      projectId: "senderos",
      goalId: "goal_1",
      agentId: undefined,
      transitionId: "transition_2",
      attemptId: "attempt_3",
      create: false,
    });
    expect(parseStudioPath("/projects/senderos/goals/new")).toMatchObject({
      view: "goals",
      projectId: "senderos",
      create: true,
    });
  });

  it("handles root, encoded IDs, and optional canvas entities", () => {
    expect(projectPath(undefined)).toBe("/");
    expect(parseStudioPath("/")).toEqual({ view: "canvas", create: false });
    expect(goalPath("my project", "goal/one")).toBe(
      "/projects/my%20project/canvas/goals/goal%2Fone",
    );
    expect(canvasEntityPath({ projectId: "p", goalId: "g" })).toBe(
      "/projects/p/canvas/goals/g",
    );
    expect(parseStudioPath("/projects/p")).toMatchObject({
      projectId: "p",
      view: "canvas",
      create: false,
    });
  });
});
