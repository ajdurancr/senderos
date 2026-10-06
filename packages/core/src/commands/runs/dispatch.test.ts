import { plan as nextPlan } from "../planning/plan";
import { expect, test } from "bun:test";
import {
  activateGoal,
  createGoal,
  getAgentTransition,
  listAgentTransitions,
} from "../../index";
import { createProjectFixture, initHome } from "../../test-support/runtime";
import { cancelRun } from "./cancel";
import { dispatchRun } from "./dispatch";
import { showRunState } from "./show-state";

test("run service dispatches and cancels a concrete attempt", async () => {
  const home = await initHome();
  const project = await createProjectFixture(home);
  const goal = (await activateGoal(
    (await createGoal({ home, projectId: project.id, title: "Run goal" })).id,
    home,
  ))!;
  const planned = (await nextPlan({ home }))[0]!;
  const transition = { id: planned.transitionId, sourceAgentId: planned.agentId };
  expect(transition.id).toBeTruthy();
  const dispatched = await dispatchRun(
    {
      goalId: goal.id,
      transitionId: transition.id,
      agentId: transition.sourceAgentId,
      workingPath: "/tmp/run-goal",
    },
    home,
  );
  expect((await showRunState(goal.id, home)).attempts).toHaveLength(1);
  expect(await cancelRun(dispatched.runId, home)).toMatchObject({ status: "canceled" });
});

test("cancelRun rejects an unknown run", async () => {
  const home = await initHome();

  await expect(cancelRun("run-missing", home)).rejects.toThrow(
    "Run not found: run-missing",
  );
});

test("dispatch rejects an invalid previous run", async () => {
  const home = await initHome();
  const project = await createProjectFixture(home);
  const goal = (await activateGoal(
    (await createGoal({ home, projectId: project.id, title: "Retry goal" })).id,
    home,
  ))!;
  const planned = (await nextPlan({ home }))[0]!;
  const transition = { id: planned.transitionId, sourceAgentId: planned.agentId };
  await expect(dispatchRun({
    goalId: goal.id,
    transitionId: transition.id,
    agentId: transition.sourceAgentId,
    previousRunId: "run-missing",
  }, home)).rejects.toThrow("previous-run-id must reference the latest completed run for this goal");
});
