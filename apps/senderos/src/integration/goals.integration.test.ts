import { describe, expect, test } from 'bun:test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initializeRuntime } from '../config/runtime';
import {
  createGoal,
  activateGoal,
  createProject,
  listAgentTransitions,
  dispatchRun,
  getAttempt,
} from '../services/runtime';

describe('goal orchestration', () => {
  test('creates a goal and records its working path on the concrete attempt', () => {
    const home = mkdtempSync(join(tmpdir(), 'senderos-goal-'));
    initializeRuntime(home);
    const project = createProject({
      home,
      canonicalPath: '/tmp/project',
      githubOwner: 'acme',
      githubRepo: 'app',
    });
    const goal = activateGoal(
      createGoal({
        home,
        projectId: project.id,
        title: 'Fix login',
        kind: 'bugfix',
        specText: 'Users can sign in.',
      }).id,
      home,
    )!;
    const transition = listAgentTransitions(home)[0]!;
    const dispatched = dispatchRun(
      {
        goalId: goal.id,
        transitionId: transition.id,
        agentId: transition.sourceAgentId,
        workingPath: '/tmp/project',
      },
      home,
    );
    expect(getAttempt(dispatched.attemptId, home)?.workingPath).toBe(
      '/tmp/project',
    );
  }, 15_000);
});
