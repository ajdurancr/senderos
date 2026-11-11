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

test('generic projects require choosing a workflow rather than inheriting software roles', async () => {
  const { createProject } = await import('../projects/create');
  const home = await initHome();
  const project = await createProject({ home, name: 'Travel research' });
  const goal = await createGoal({ home, projectId: project.id, title: 'Compare destinations', kind: 'research' });
  expect(goal).toMatchObject({ kind: 'research', senderoVersionId: null, baseTargetBranch: '' });
  await expect(activateGoal(goal.id, home)).rejects.toThrow('Assign a published Sendero');
  const { getSenderoGraph } = await import('../senderos/get-graph');
  const chosen = (await getSenderoGraph('timed-wait-demo', undefined, home))!;
  const assigned = await createGoal({ home, projectId: project.id, title: 'Check a process', senderoVersionId: chosen.version.id });
  expect(assigned.senderoVersionId).toBe(chosen.version.id);
});

test('reviewed draft goal edits reject stale preparation without changing persisted inputs', async () => {
  const home = await initHome();
  const project = await createProjectFixture(home);
  const goal = await createGoal({ home, projectId: project.id, title: 'Initial scope', specText: 'Initial acceptance' });
  const expectedDraft = { title: goal.title, kind: goal.kind, specText: goal.specText, senderoVersionId: goal.senderoVersionId };
  await updateGoal({ home, id: goal.id, title: 'Other operator scope' });
  await expect(updateGoal({ home, id: goal.id, title: 'Stale local scope', expectedDraft })).rejects.toMatchObject({ code: 'STALE_GOAL_DRAFT' });
  expect((await getGoal(goal.id, home))?.title).toBe('Other operator scope');
});

test('reviewed draft goal preparation cannot change a goal activated since review', async () => {
  const home = await initHome();
  const project = await createProjectFixture(home);
  const goal = await createGoal({ home, projectId: project.id, title: 'Ready to start' });
  const expectedDraft = { title: goal.title, kind: goal.kind, specText: goal.specText, senderoVersionId: goal.senderoVersionId };
  await activateGoal(goal.id, home);
  await expect(updateGoal({ home, id: goal.id, specText: 'Changed after start', expectedDraft })).rejects.toMatchObject({ code: 'GOAL_NOT_DRAFT' });
  expect((await getGoal(goal.id, home))?.specText).toBe(goal.specText);
});

test('reviewed goal preparation saves valid fields and can assign a published workflow without activation', async () => {
  const { createProject } = await import('../projects/create');
  const { getSenderoGraph } = await import('../senderos/get-graph');
  const home = await initHome();
  const project = await createProject({ home, name: 'Preparation only' });
  const goal = await createGoal({ home, projectId: project.id, title: 'Incomplete goal' });
  const expectedDraft = { title: goal.title, kind: goal.kind, specText: goal.specText, senderoVersionId: goal.senderoVersionId };
  const workflow = (await getSenderoGraph('timed-wait-demo', undefined, home))!;
  const saved = await updateGoal({ home, id: goal.id, title: 'Prepared goal', kind: 'research', specText: 'Inspect a recorded wait', senderoVersionId: workflow.version.id, expectedDraft });
  expect(saved).toMatchObject({ status: 'draft', title: 'Prepared goal', kind: 'research', specText: 'Inspect a recorded wait', senderoVersionId: workflow.version.id });
});
