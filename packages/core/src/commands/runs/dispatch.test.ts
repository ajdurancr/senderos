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
  }, home)).rejects.toThrow("previous-run-id must reference this activation's predecessor or retry");
});

import { createSenderos, createProject, registerExecutionContext } from '../../index';
import { openRuntimeDb } from '../../db/client';
import { runs } from '../../db/schema';
test('reviewed batch dispatch validates every revision and context before reserving any item', async () => {
  const home = await initHome(), project = await createProjectFixture(home);
  const api = createSenderos({ home, allExecutionContexts: true });
  const first = await createGoal({ home, projectId: project.id, title: 'First scoped goal' }); await activateGoal(first.id, home);
  const second = await createGoal({ home, projectId: project.id, title: 'Second scoped goal' }); await activateGoal(second.id, home);
  const items = await api.commands.plan();
  await expect(api.commands.runs.dispatchReviewed({ items: [] })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  await expect(api.commands.runs.dispatchReviewed({ items: [items[0]!, items[0]!] })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  await expect(api.commands.runs.dispatchReviewed({ items: [items[0]!, { ...items[1]!, revision: -1 }] })).rejects.toMatchObject({ code: 'STALE_PLAN' });
  expect(await openRuntimeDb(home).select().from(runs)).toHaveLength(0);
  await expect(api.commands.runs.dispatchReviewed({ items, projectId: 'wrong-project' })).rejects.toMatchObject({ code: 'SCOPE_MISMATCH' });
  const result = await api.commands.runs.dispatchReviewed({ items, executionContextId: project.executionContextId, projectId: project.id });
  expect(result).toHaveLength(2); expect(await openRuntimeDb(home).select().from(runs)).toHaveLength(2);
  await expect(api.commands.runs.dispatchReviewed({ items })).rejects.toMatchObject({ code: 'STALE_PLAN' });
});
test('reviewed scoped dispatch leaves undisplayed contexts unreserved', async () => {
  const home = await initHome(), projectA = await createProjectFixture(home);
  await registerExecutionContext({ home, id: 'context-b', name: 'Context B' });
  const projectB = await createProject({ home, executionContextId: 'context-b', id: 'project-b', name: 'Project B', canonicalPath: '/context-b', githubOwner: 'example', githubRepo: 'example' });
  const api = createSenderos({ home, allExecutionContexts: true });
  const goalA = await api.commands.goals.create({ projectId: projectA.id, title: 'A' });
  const goalB = await api.commands.goals.create({ projectId: projectB.id, title: 'B' });
  await api.commands.goals.activate(goalA.id); await api.commands.goals.activate(goalB.id);
  const all = await api.commands.plan(), visible = all.filter(i => i.goalId === goalA.id);
  await expect(api.commands.runs.dispatchReviewed({ items: all, executionContextId: projectA.executionContextId })).rejects.toMatchObject({ code: 'SCOPE_MISMATCH' });
  expect(await openRuntimeDb(home).select().from(runs)).toHaveLength(0);
  await api.commands.runs.dispatchReviewed({ items: visible, executionContextId: projectA.executionContextId });
  expect(await api.commands.plan()).toMatchObject([{ goalId: goalB.id }]);
});
