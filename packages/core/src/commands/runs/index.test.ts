import { expect, test } from "bun:test";
import { createRunRecord } from "./create";
import { getRun } from "./get";
import { latestRunForGoal } from "./latest-for-goal";
import { activateGoal, createGoal } from "../../index";
import { createProjectFixture, initHome } from "../../test-support/runtime";

test("run dispatch persistence creates and retrieves a run for a goal", async () => {
  const home = await initHome();
  const project = await createProjectFixture(home);
  const goal = (await activateGoal(
    (
      await createGoal({
        home,
        projectId: project.id,
        title: "Dispatch persistence",
      })
    ).id,
    home,
  ))!;
  const run: any = await createRunRecord(goal, home);
  expect(((await getRun(run.id, home)) as any).id).toBe(run.id);
  expect(((await latestRunForGoal(goal.id, home)) as any).id).toBe(run.id);
});
