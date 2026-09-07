import { describe, expect, test } from 'bun:test';
import {
  createGoal,
  activateGoal,
  createProject,
  listAgentTransitions,
  dispatchRun,
  getAttempt,
} from '../commands';
import { initHome } from '../test-support/runtime';

describe('goal orchestration', () => {
  test('creates a goal and records its working path on the concrete attempt', async () => {
    const home = await initHome();
    const project = await createProject({
      home,
      canonicalPath: '/tmp/project',
      githubOwner: 'acme',
      githubRepo: 'app',
    });
    const goal = (await activateGoal(
      (await createGoal({
        home,
        projectId: project.id,
        title: 'Fix login',
        kind: 'bugfix',
        specText: 'Users can sign in.',
      })).id,
      home,
    ))!;
    const transition = (await listAgentTransitions(home))[0]!;
    const dispatched = await dispatchRun(
      {
        goalId: goal.id,
        transitionId: transition.id,
        agentId: transition.sourceAgentId,
        workingPath: '/tmp/project',
      },
      home,
    );
    expect((await getAttempt(dispatched.attemptId, home))?.workingPath).toBe(
      '/tmp/project',
    );
  }, 15_000);
});
