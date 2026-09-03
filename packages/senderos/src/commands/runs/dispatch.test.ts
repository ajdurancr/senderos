import { expect, test } from 'bun:test';
import { activateGoal, createGoal, getAgentTransition, listAgentTransitions } from '../../index';
import { createProjectFixture, initHome } from '../../test-support/runtime';
import { cancelRun } from './cancel';
import { dispatchRun } from './dispatch';
import { showRunState } from './show-state';

test('run service dispatches and cancels a concrete attempt', () => {
  const home = initHome(); const project = createProjectFixture(home);
  const goal = activateGoal(createGoal({ home, projectId: project.id, title: 'Run goal' }).id, home)!;
  const transition = listAgentTransitions(home)[0]!;
  expect(getAgentTransition(transition.id, home)?.id).toBe(transition.id);
  const dispatched = dispatchRun({ goalId: goal.id, transitionId: transition.id, agentId: transition.sourceAgentId, workingPath: '/tmp/run-goal' }, home);
  expect(showRunState(goal.id, home).attempts).toHaveLength(1);
  expect((cancelRun(dispatched.runId, home) as any).status).toBe('canceled');
});
