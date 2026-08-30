import { describe, expect, test } from 'bun:test';

import { openRuntimeDb } from '../../db/client';
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
} from './index';
import { cancelRun, dispatchRun, resumeAttempt } from './run/run';
import { createRunRecord, getRun } from './run/dispatch';
import { createProjectFixture, initHome } from '../../../tests/helpers/runtime';
import { handleAttempt } from '../../cli/commands/attempt';
import { handleGoal } from '../../cli/commands/goal';
import { handlePlan } from '../../cli/commands/plan';
import { handleRun } from '../../cli/commands/run';
import { handleSystemCommand } from '../../cli/commands/system';
import { handleTransition } from '../../cli/commands/transition';

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

    const db = openRuntimeDb(home);
    db.prepare("update runs set status='failed' where id=?").run(
      dispatched.runId,
    );
    db.close();
    expect(
      plan({ home }).some((item) => item.previousRunId === dispatched.runId),
    ).toBe(true);

    const directRun = createRunRecord(updated, home)! as any;
    const directAttempt = createRunAttempt({
      home,
      runId: directRun.id,
      attemptNumber: 1,
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
    expect((getRun(directRun.id, home) as any)?.goal_id).toBe(goal.id);
    expect(getAttempt(directAttempt.id, home)?.externalSessionId).toBe(
      'external-1',
    );

    expect((cancelRun(directRun.id, home) as any)?.status).toBe('canceled');
    expect(cancelGoal(goal.id, home)?.status).toBe('canceled');
    expect(() => cancelGoal('missing', home)).toThrow('Goal not found');
    expect(() =>
      dispatchRun(
        { goalId: 'missing', transitionId: handoff.id, agentId: agent.id },
        home,
      ),
    ).toThrow('Goal not found');
  });

  test('exposes the goal model through the CLI command handlers', () => {
    const home = initHome();
    const project = createProjectFixture(home);
    const created = handleGoal(
      'create',
      ['goal', 'create'],
      {
        'project-id': project.id,
        title: 'CLI goal',
        kind: 'maintenance',
        'spec-text': 'Keep dependencies healthy.',
        'intake-text': 'Please update dependencies.',
      },
      home,
    ) as any;
    expect((handleGoal as any)('list', [], {}, home)).toHaveLength(1);
    expect(
      (handleGoal as any)('show', ['goal', 'show', created.id], {}, home)?.id,
    ).toBe(created.id);
    expect(
      (handleGoal as any)(
        'update',
        ['goal', 'update', created.id],
        { title: 'Updated CLI goal' },
        home,
      )?.title,
    ).toBe('Updated CLI goal');
    handleGoal('activate', ['goal', 'activate', created.id], {}, home);

    const agent = getAgentBySlug('spec-partner', home)!;
    const transition = handleTransition(
      'create',
      [],
      {
        'source-agent-id': agent.id,
        name: 'CLI transition',
        objective: 'Implement the goal.',
      },
      home,
    ) as any;
    expect((handleTransition as any)('list', [], {}, home)).toHaveLength(6);
    expect(
      (handleTransition as any)('list', [], { 'agent-id': agent.id }, home)
        .length,
    ).toBeGreaterThan(0);
    expect(
      (handleTransition as any)(
        'show',
        ['transition', 'show', transition.id],
        {},
        home,
      )?.id,
    ).toBe(transition.id);

    const item = (handlePlan({ 'goal-status': 'active' }, home) as any[]).find(
      (entry) => entry.goalId === created.id,
    )!;
    const dispatched = handleRun(
      'dispatch',
      [],
      {
        'goal-id': item.goalId,
        'transition-id': item.transitionId,
        'agent-id': item.agentId,
        'working-path': '/tmp/cli-goal',
      },
      home,
    ) as any;
    expect(
      (handleRun as any)('state', ['run', 'state', created.id], {}, home).goal
        .id,
    ).toBe(created.id);
    expect((handleRun as any)('list', [], {}, home)).toHaveLength(1);
    expect(
      (handleRun as any)('show', ['run', 'show', dispatched.runId], {}, home)
        ?.id,
    ).toBe(dispatched.runId);
    expect(
      (handleAttempt as any)('list', [], { 'run-id': dispatched.runId }, home),
    ).toHaveLength(1);
    expect(
      (handleAttempt as any)(
        'show',
        ['attempt', 'show', dispatched.attemptId],
        {},
        home,
      )?.id,
    ).toBe(dispatched.attemptId);
    expect(
      (handleAttempt as any)(
        'resume',
        ['attempt', 'resume', dispatched.attemptId],
        {},
        home,
      ).attempt.id,
    ).toBe(dispatched.attemptId);
    expect((handleSystemCommand as any)('status', home).openGoals).toBe(1);
    expect((handleSystemCommand as any)('doctor', home).ok).toBe(true);
    expect(
      (handleRun as any)(
        'cancel',
        ['run', 'cancel', dispatched.runId],
        {},
        home,
      )?.status,
    ).toBe('canceled');
  });
});
