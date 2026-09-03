import { expect, test } from 'bun:test';
import { createGoal, activateGoal } from './goals';
import { plan } from './plan';
import { getAgentBySlug } from './agents';
import { updateRunAttempt } from './attempts';
import { createAgentTransition, listAgentTransitions } from './transitions';
import { dispatchRun } from './runs/execution';
import { createProjectFixture, initHome } from '../../tests/helpers/runtime';

test('planner skips draft goals and selects active goals', () => {
  const home = initHome();
  const project = createProjectFixture(home);
  createGoal({ home, projectId: project.id, title: 'Draft' });
  const active = activateGoal(
    createGoal({ home, projectId: project.id, title: 'Active' }).id,
    home,
  )!;
  const items = plan({ home });
  expect(items).toHaveLength(1);
  expect(items[0]?.goalId).toBe(active.id);
});

test('planner advances from a succeeded transition to its target agent transition', () => {
  const home = initHome();
  const project = createProjectFixture(home);
  const source = getAgentBySlug('spec-partner', home)!;
  const target = getAgentBySlug('tdd-craftsman', home)!;
  const handoff = createAgentTransition({
    home,
    sourceAgentId: source.id,
    targetAgentId: target.id,
    name: 'handoff to implementation',
    transitionObjective: 'Hand off to implementation.',
  });
  const goal = activateGoal(createGoal({ home, projectId: project.id, title: 'Advance' }).id, home)!;
  const dispatched = dispatchRun({ goalId: goal.id, transitionId: handoff.id, agentId: source.id }, home);
  updateRunAttempt(dispatched.attemptId, { status: 'succeeded' }, home);

  const next = plan({ home }).find((item) => item.goalId === goal.id);
  expect(next?.agentId).toBe(target.id);
  expect(next?.transitionId).toBe(listAgentTransitions(home).find((item) => item.sourceAgentId === target.id)?.id);
});
