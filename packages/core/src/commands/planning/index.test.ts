import { expect, test } from 'bun:test';
import { createGoal, activateGoal } from '../goals';
import { getAgentBySlug } from '../agents/get-by-slug';
import { updateRunAttempt } from '../attempts';
import { createAgentTransition, listAgentTransitions } from '../transitions';
import { dispatchRun } from '../runs/dispatch';
import { createProjectFixture, initHome } from '../../test-support/runtime';
import { plan } from './plan';
test('planner skips draft goals and selects active goals', async () => {
  const home = await initHome();
  const project = await createProjectFixture(home);
  await createGoal({ home, projectId: project.id, title: 'Draft' });
  const active = (await activateGoal(
    (await createGoal({ home, projectId: project.id, title: 'Active' })).id,
    home,
  ))!;
  const items = await plan({ home });
  expect(items).toHaveLength(1);
  expect(items[0]?.goalId).toBe(active.id);
});
test('planner advances from a succeeded transition to its target agent transition', async () => {
  const home = await initHome();
  const project = await createProjectFixture(home);
  const source = (await getAgentBySlug('spec-partner', home))!;
  const target = (await getAgentBySlug('tdd-craftsman', home))!;
  const handoff = await createAgentTransition({
    home,
    sourceAgentId: source.id,
    targetAgentId: target.id,
    name: 'handoff to implementation',
    transitionObjective: 'Hand off to implementation.',
  });
  const goal = (await activateGoal(
    (await createGoal({ home, projectId: project.id, title: 'Advance' })).id,
    home,
  ))!;
  const dispatched = await dispatchRun(
    { goalId: goal.id, transitionId: handoff.id, agentId: source.id },
    home,
  );
  await updateRunAttempt(dispatched.attemptId, { status: 'succeeded' }, home);
  const next = (await plan({ home })).find((item) => item.goalId === goal.id);
  expect(next?.agentId).toBe(target.id);
  expect(next?.transitionId).toBe(
    (await listAgentTransitions(home)).find((item) => item.sourceAgentId === target.id)
      ?.id,
  );
});
