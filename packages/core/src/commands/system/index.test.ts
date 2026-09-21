import { describe, expect, test } from "bun:test";
import { rmSync } from "node:fs";
import { resolveRuntime } from "../../shared/config";
import { createGoal, activateGoal } from "../goals";
import { createRunRecord } from "../runs/create";
import { createRunAttempt } from "../attempts/create";
import { getAgentBySlug } from "../agents/get-by-slug";
import {
  createProjectFixture,
  initHome,
  tempHome,
} from "../../test-support/runtime";
import { doctor } from "./health";
import { status } from "./status";
describe("runtime health operations", () => {
  test("reports doctor failures for missing config and directories", async () => {
    expect((await doctor(tempHome())).ok).toBe(false);
    const home = await initHome();
    const logRoot = resolveRuntime(home).paths.logRoot;
    rmSync(logRoot, { recursive: true, force: true });
    expect((await doctor(home)).issues).toContain(`missing dir:${logRoot}`);
  });
});
test("status aggregates current project and goal state", async () => {
  const home = await initHome();
  const project = await createProjectFixture(home);
  const goal = (await activateGoal(
    (await createGoal({ home, projectId: project.id, title: "Visible goal" }))
      .id,
    home,
  ))!;
  const result = await status(home);
  expect(result.projects.total).toBe(1);
  expect(result.activeGoalIds).toContain(goal.id);
  const run = (await createRunRecord(goal, home))!;
  const agent = (await getAgentBySlug("spec-partner", home))!;
  const attempt = await createRunAttempt({
    home,
    runId: run.id,
    attemptNumber: 1,
    agentId: agent.id,
    executionObjective: "Check scoped status",
    harness: "codex",
  });
  const scoped = await status(home, project.executionContextId);
  expect(scoped.projects).toEqual({ total: 1, unhealthy: 0 });
  expect(scoped.runningRunIds).toContain(run.id);
  expect(scoped.activeAttemptIds).toContain(attempt.id);
});
