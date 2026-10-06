import { expect, test } from "bun:test";
import {
  activateGoal,
  createGoal,
  getGoal,
  listGoals,
  updateGoal,
} from "./index";
import { createProjectFixture, initHome } from "../../test-support/runtime";

test("goal service persists, updates, activates, and lists goals", async () => {
  const home = await initHome();
  const project = await createProjectFixture(home);
  const goal = await createGoal({
    home,
    projectId: project.id,
    title: "Improve search",
    kind: "feature",
  });
  expect(await listGoals(home)).toHaveLength(1);
  expect(
    (
      await updateGoal({
        home,
        id: goal.id,
        specText: "Search ranks relevant results.",
      })
    )?.specText,
  ).toContain("ranks");
  expect((await activateGoal(goal.id, home))?.status).toBe("active");
  expect((await getGoal(goal.id, home))?.id).toBe(goal.id);
});

test("goal creation is idempotent and accepts an explicit published version", async () => {
  const home = await initHome();
  const project = await createProjectFixture(home);
  const defaultGoal = await createGoal({
    home,
    projectId: project.id,
    title: "Find published version",
  });
  expect(defaultGoal.senderoVersionId).not.toBeNull();

  const input = {
    home,
    id: "stable-goal-id",
    projectId: project.id,
    title: "Idempotent goal",
    senderoVersionId: defaultGoal.senderoVersionId,
  };
  const created = await createGoal(input);
  expect(await createGoal(input)).toEqual(created);
  await expect(
    createGoal({ ...input, title: "Conflicting replay" }),
  ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
});
