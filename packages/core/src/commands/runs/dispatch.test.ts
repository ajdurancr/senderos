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
  const transition = (await listAgentTransitions(home))[0]!;
  expect((await getAgentTransition(transition.id, home))?.id).toBe(
    transition.id,
  );
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
  expect(((await cancelRun(dispatched.runId, home)) as any).status).toBe(
    "canceled",
  );
});

test("cancelRun rejects an unknown run", async () => {
  const home = await initHome();

  await expect(cancelRun("run-missing", home)).rejects.toThrow(
    "Run not found: run-missing",
  );
});
