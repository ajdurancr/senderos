import { startTestWorker } from '../test-support/worker';
import { plan as nextPlan } from "../commands/planning/plan";
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
    const planned = (await nextPlan({ home }))[0]!;
  const transition = { id: planned.transitionId, sourceAgentId: planned.agentId };
    const dispatched = await dispatchRun(
      {
        goalId: goal.id,
        transitionId: transition.id,
        agentId: transition.sourceAgentId,
        workingPath: '/tmp/project',
      },
      home,
    );
    expect((await getAttempt(dispatched.attemptId, home))?.workingPath).toBeNull();
    await startTestWorker(home, project.id, dispatched.attemptId, "/tmp/project");
    expect((await getAttempt(dispatched.attemptId, home))?.workingPath).toBe(
      '/tmp/project',
    );
  }, 15_000);
});
