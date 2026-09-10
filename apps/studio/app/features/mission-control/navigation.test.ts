import { describe, expect, it } from "vitest";

import {
  attemptPath,
  canvasAgentPath,
  canvasEntityPath,
  goalPath,
  parseStudioPath,
  projectPath,
  senderoPath,
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

  it("keeps Sendero, node, and arc identities in durable paths", () => {
    expect(senderoPath("delivery trail", { nodeId: "node/start" })).toBe("/senderos/delivery%20trail/nodes/node%2Fstart");
    expect(senderoPath("delivery", { edgeId: "edge_2" })).toBe("/senderos/delivery/edges/edge_2");
    expect(parseStudioPath("/senderos/delivery/edges/edge_2")).toMatchObject({ view: "senderos", senderoId: "delivery", senderoEdgeId: "edge_2" });
    expect(parseStudioPath("/senderos/delivery/nodes/node_1")).toMatchObject({ view: "senderos", senderoId: "delivery", senderoNodeId: "node_1" });
  });

  it("handles root, encoded IDs, and optional canvas entities", () => {
    expect(projectPath(undefined)).toBe("/canvas");
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

  it("keeps every workspace screen navigable before a project exists", () => {
    expect(projectPath(undefined, "goals")).toBe("/goals");
    expect(projectPath(undefined, "runs")).toBe("/runs");
    expect(projectPath(undefined, "agents")).toBe("/agents");
    expect(projectPath(undefined, "events")).toBe("/events");
    expect(projectPath(undefined, "settings")).toBe("/settings");
    expect(parseStudioPath("/goals/new")).toEqual({
      view: "goals",
      attemptId: undefined,
      create: true,
    });
    expect(parseStudioPath("/runs/attempts/attempt_1")).toEqual({
      view: "runs",
      attemptId: "attempt_1",
      create: false,
    });
  });
});
