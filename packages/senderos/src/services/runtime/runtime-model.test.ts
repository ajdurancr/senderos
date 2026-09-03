import { describe, expect, test } from 'bun:test';

import {
  activateGoal,
  cancelGoal,
  createAgentTransition,
  createGoal,
  createRunAttempt,
  getAgent,
  getAgentBySlug,
  getAgentTransition,
  getAttempt,
  getGoal,
  listAgentTransitions,
  listAgentTransitionsForAgent,
  listGoals,
  listRunAttempts,
  listRuns,
  plan,
  showRunState,
  status,
  updateGoal,
  updateRunAttempt,
} from '@senderos/senderos';
import { cancelRun, dispatchRun, resumeAttempt } from '@senderos/senderos';
import { createProjectFixture, initHome } from '../../../tests/helpers/runtime';

describe('goal orchestration runtime model', () => {
  test('manages goals, transitions, runs, attempts, planning, and status', () => {
    const home = initHome();
    const project = createProjectFixture(home);
    const agent = getAgentBySlug('spec-partner', home)!;

    expect(getAgent(agent.id, home)?.slug).toBe('spec-partner');
    expect(getAgentBySlug('missing', home)).toBeNull();

    const goal = createGoal({
      home,
      projectId: project.id,
      title: 'Repair login flow',
      kind: 'bugfix',
      intakeText: 'Login is broken.',
      specText: 'Users can sign in.',
    });
    expect(listGoals(home)).toHaveLength(1);
    expect(getGoal(goal.id, home)?.kind).toBe('bugfix');

    const updated = updateGoal({
      home,
      id: goal.id,
      title: 'Repair sign-in flow',
      prUrl: 'https://example.test/pr/1',
      prNumber: 1,
      branchName: 'fix/sign-in',
    })!;
    expect(updated.title).toBe('Repair sign-in flow');
    expect(() => updateGoal({ home, id: 'missing' })).toThrow('Goal not found');

    activateGoal(goal.id, home);
    const defaultTransition = listAgentTransitions(home)[0]!;
    const handoff = createAgentTransition({
      home,
      sourceAgentId: agent.id,
      targetAgentId: defaultTransition.sourceAgentId,
      name: 'Review handoff',
      description: 'Hand off implementation for review.',
      transitionObjective: 'Review the delivered work.',
      assignmentMeta: { priority: 'high' },
    });
    expect(getAgentTransition(handoff.id, home)?.transitionObjective).toContain(
      'Review',
    );
    expect(listAgentTransitionsForAgent(agent.id, home).length).toBeGreaterThan(
      0,
    );
    expect(getAgentTransition('missing', home)).toBeNull();

    const items = plan({ home });
    expect(items.some((item) => item.goalId === goal.id)).toBe(true);
    const dispatched = dispatchRun(
      {
        goalId: goal.id,
        transitionId: defaultTransition.id,
        agentId: defaultTransition.sourceAgentId,
        workingPath: '/tmp/senderos-sign-in',
      },
      home,
    );
    expect(listRuns(home)).toHaveLength(1);
    expect(showRunState(goal.id, home).attempts).toHaveLength(1);

    const attempt = getAttempt(dispatched.attemptId, home)!;
    expect(resumeAttempt(attempt.id, home).attempt.id).toBe(attempt.id);
    expect(() => resumeAttempt('missing', home)).toThrow(
      'Run attempt not found',
    );
    expect(
      updateRunAttempt(
        attempt.id,
        {
          status: 'failed',
          checkpoint: 'validation_failed',
          failureStep: 'test',
          failureSummary: 'A test failed.',
          result: { ok: false },
          statusSnapshot: { state: 'failed' },
        },
        home,
      )?.failureStep,
    ).toBe('test');
    expect(() => updateRunAttempt('missing', {}, home)).toThrow(
      'Run attempt not found',
    );
    expect(listRunAttempts(dispatched.runId, home)).toHaveLength(1);
    expect(status(home).activeGoalIds).toContain(goal.id);

    expect(
      plan({ home }).some((item) => item.previousRunId === dispatched.runId),
    ).toBe(true);

    const directAttempt = createRunAttempt({
      home,
      runId: dispatched.runId,
      attemptNumber: 2,
      agentId: agent.id,
      executionObjective: 'Investigate the failure.',
      harness: 'codex',
      externalSessionId: 'external-1',
      resumeCommand: 'resume external-1',
      heartbeatAt: '2026-08-28T00:00:00.000Z',
      hostEnvironmentName: 'local',
      workingPath: '/tmp/direct',
      workingPathMode: 'new',
      retryFromAttemptId: attempt.id,
      sourceGoalSha: 'abc123',
      debugMeta: { source: 'test' },
      startedAt: '2026-08-28T00:00:00.000Z',
    });
    expect(getAttempt(directAttempt.id, home)?.externalSessionId).toBe(
      'external-1',
    );

    expect((cancelRun(dispatched.runId, home) as any)?.status).toBe('canceled');
    expect(cancelGoal(goal.id, home)?.status).toBe('canceled');
    expect(() => cancelGoal('missing', home)).toThrow('Goal not found');
    expect(() =>
      dispatchRun(
        { goalId: 'missing', transitionId: handoff.id, agentId: agent.id },
        home,
      ),
    ).toThrow('Goal not found');
  });

});
