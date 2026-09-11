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
} from '@senderos/core';
import { cancelRun, dispatchRun, resumeAttempt } from '@senderos/core';
import { createProjectFixture, initHome } from '../test-support/runtime';

describe('goal orchestration runtime model', () => {
  test('manages goals, transitions, runs, attempts, planning, and status', async () => {
    const home = await initHome();
    const project = await createProjectFixture(home);
    const agent = (await getAgentBySlug('spec-partner', home))!;

    expect((await getAgent(agent.id, home))?.slug).toBe('spec-partner');
    expect(await getAgentBySlug('missing', home)).toBeNull();

    const goal = await createGoal({
      home,
      projectId: project.id,
      title: 'Repair login flow',
      kind: 'bugfix',
      intakeText: 'Login is broken.',
      specText: 'Users can sign in.',
      senderoVersionId: null,
    });
    expect(await listGoals(home)).toHaveLength(1);
    expect((await getGoal(goal.id, home))?.kind).toBe('bugfix');

    const updated = (await updateGoal({
      home,
      id: goal.id,
      title: 'Repair sign-in flow',
      prUrl: 'https://example.test/pr/1',
      prNumber: 1,
      branchName: 'fix/sign-in',
    }))!;
    expect(updated.title).toBe('Repair sign-in flow');
    await expect(updateGoal({ home, id: 'missing' })).rejects.toThrow('Goal not found');

    await activateGoal(goal.id, home);
    const defaultTransition = (await listAgentTransitions(home))[0]!;
    const handoff = await createAgentTransition({
      home,
      sourceAgentId: agent.id,
      targetAgentId: defaultTransition.sourceAgentId,
      name: 'Review handoff',
      description: 'Hand off implementation for review.',
      transitionObjective: 'Review the delivered work.',
      assignmentMeta: { priority: 'high' },
    });
    expect((await getAgentTransition(handoff.id, home))?.transitionObjective).toContain(
      'Review',
    );
    expect((await listAgentTransitionsForAgent(agent.id, home)).length).toBeGreaterThan(
      0,
    );
    expect(await getAgentTransition('missing', home)).toBeNull();

    const items = await plan({ home });
    expect(items.some((item) => item.goalId === goal.id)).toBe(true);
    const dispatched = await dispatchRun(
      {
        goalId: goal.id,
        transitionId: defaultTransition.id,
        agentId: defaultTransition.sourceAgentId,
        workingPath: '/tmp/senderos-sign-in',
      },
      home,
    );
    expect(await listRuns(home)).toHaveLength(1);
    expect((await showRunState(goal.id, home)).attempts).toHaveLength(1);

    const attempt = (await getAttempt(dispatched.attemptId, home))!;
    expect((await resumeAttempt(attempt.id, home)).attempt.id).toBe(attempt.id);
    await expect(resumeAttempt('missing', home)).rejects.toThrow(
      'Run attempt not found',
    );
    expect(
      (await updateRunAttempt(
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
      ))?.failureStep,
    ).toBe('test');
    await expect(updateRunAttempt('missing', {}, home)).rejects.toThrow(
      'Run attempt not found',
    );
    expect(await listRunAttempts(dispatched.runId, home)).toHaveLength(1);
    expect((await status(home)).activeGoalIds).toContain(goal.id);

    expect(
      (await plan({ home })).some((item) => item.previousRunId === dispatched.runId),
    ).toBe(true);

    const directAttempt = await createRunAttempt({
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
    expect((await getAttempt(directAttempt.id, home))?.externalSessionId).toBe(
      'external-1',
    );

    expect((await cancelRun(dispatched.runId, home) as any)?.status).toBe('canceled');
    expect((await cancelGoal(goal.id, home))?.status).toBe('canceled');
    await expect(cancelGoal('missing', home)).rejects.toThrow('Goal not found');
    await expect(
      dispatchRun(
        { goalId: 'missing', transitionId: handoff.id, agentId: agent.id },
        home,
      ),
    ).rejects.toThrow('Goal not found');
  });
});
