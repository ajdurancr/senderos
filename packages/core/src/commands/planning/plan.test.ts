import { expect, test } from 'bun:test';
import { planFromDecisions } from './plan';
import type { GoalStatus, RunAttemptRecord } from '../../shared/types';
import { createSenderos, registerExecutionContext } from '../../index';
import { createProjectFixture, initHome } from '../../test-support/runtime';
import { scopedApi } from '../../lifecycle/scope';
import { registerHost, grantHostWorkspace, declareHostWorkspace } from '../../lifecycle/host-registry';
import { claimAttempt, startAttempt } from '../../lifecycle/hosts';

type Decision = Parameters<typeof planFromDecisions>[1][number];
function decision(goalId: string, states: Array<'ready' | 'blocked' | 'running'>): Decision {
  return { goalId, state: states[0] ?? 'completed', reason: 'fixture', nextAction: 'fixture', activations: states.map((state, index) => ({
    goalId, activationId: `${goalId}-${index}`, state, reason: 'fixture', nextAction: 'fixture',
    transitionId: `transition-${index}`, agentId: 'worker', revision: index + 1,
    ...(index ? { previousRunId: 'previous-run' } : {}),
  })) };
}

test('snapshot plans preserve goal and activation order, eligibility and retry metadata', () => {
  const statuses: GoalStatus[] = ['draft', 'active', 'failed', 'blocked', 'completed', 'canceled'];
  const goals = statuses.map(status => ({ id: status, status }));
  const decisions = statuses.map(status => decision(status, ['ready', 'blocked', 'ready', 'running'])).reverse();
  const items = planFromDecisions(goals, decisions);
  expect(items.map(item => item.activationId)).toEqual(['active-0', 'active-2', 'failed-0', 'failed-2', 'blocked-0', 'blocked-2']);
  expect(items[0]).toEqual({ goalId: 'active', activationId: 'active-0', transitionId: 'transition-0', agentId: 'worker', previousRunId: null, revision: 1 });
  expect(items[1]).toMatchObject({ previousRunId: 'previous-run', revision: 3 });
  expect(planFromDecisions(goals, decisions, [])).toEqual(items);
  expect(planFromDecisions(goals, decisions, ['draft']).map(item => item.activationId)).toEqual(['draft-0', 'draft-2']);
});

test('snapshot plans do not invent missing or non-ready decisions', () => {
  const goals = [{ id: 'missing', status: 'active' as const }, { id: 'waiting', status: 'blocked' as const }];
  expect(planFromDecisions(goals, [decision('foreign', ['ready']), decision('waiting', ['blocked', 'running'])])).toEqual([]);
  expect(planFromDecisions([], [decision('foreign', ['ready'])])).toEqual([]);
});

async function contextFixture() {
  const home = await initHome();
  const selectedProject = await createProjectFixture(home);
  await registerExecutionContext({ home, id: 'other-planning-context', name: 'Other planning context' });
  const otherProject = await createProjectFixture(home, { name: 'Other planning project', executionContextId: 'other-planning-context' });
  const all = createSenderos({ home, allExecutionContexts: true });
  const selected = createSenderos({ home, executionContextId: selectedProject.executionContextId });
  const selectedGoal = await all.commands.goals.create({ projectId: selectedProject.id, title: 'Selected planning goal' });
  const otherGoal = await all.commands.goals.create({ projectId: otherProject.id, title: 'Other planning goal' });
  return { home, all, selected, selectedProject, otherProject, selectedGoal, otherGoal };
}

test('scoped Mission Control start ignores another context while preserving its goal and scope rejection', async () => {
  const { all, selected, selectedGoal, otherGoal } = await contextFixture();
  await all.commands.goals.activate(otherGoal.id);
  const started = await selected.missionControl.startGoal({ goalId: selectedGoal.id });
  expect(started.goal.status).toBe('active');
  expect(started.attempts).toHaveLength(1);
  expect((await all.commands.runs.list()).map(run => run.goalId)).toEqual([selectedGoal.id]);
  expect((await all.commands.goals.get(otherGoal.id))?.status).toBe('active');
  await expect(selected.missionControl.startGoal({ goalId: otherGoal.id })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  expect(await all.commands.runs.list()).toHaveLength(1);
});

test('scoped Mission Control retry retains retry lineage without explaining unrelated failed goals', async () => {
  const { home, all, selected, selectedProject, otherProject, selectedGoal, otherGoal } = await contextFixture();
  const failures: RunAttemptRecord[] = [];
  for (const [project, goal] of [[selectedProject, selectedGoal], [otherProject, otherGoal]] as const) {
    const started = await all.missionControl.startGoal({ goalId: goal.id });
    const first = started.attempts[0]!;
    const claim = await scopedApi({ start: async () => {
      const hostId = `worker-${project.id}`;
      await registerHost({ id: hostId, name: 'Scoped fixture worker', harness: 'deterministic-test', capabilities: ['independent_session', 'shell'] }, home);
      await grantHostWorkspace({ hostId, projectId: project.id, workspaceRef: project.id }, home);
      await declareHostWorkspace({ hostId, projectId: project.id, available: true, workingPath: project.canonicalPath }, home);
      const claim = await claimAttempt({ attemptId: first.id, ownerId: hostId }, home);
      await startAttempt({ attemptId: first.id, token: claim.token, externalSessionId: `fixture:${first.id}`, parentSessionId: 'controller', workingPath: project.canonicalPath }, home);
      return claim;
    } }, project.executionContextId).start();
    await all.commands.attempts.update(first.id, { token: claim.token, status: 'failed', failureSummary: `Recover ${goal.title}` });
    failures.push(first);
  }
  const retried = await selected.missionControl.retryExecution({ goalId: selectedGoal.id });
  expect(retried.attempts).toHaveLength(1);
  expect((await selected.commands.attempts.list()).find(attempt => attempt.id === failures[0]!.id)?.status).toBe('failed');
  expect(retried.attempts.find(attempt => attempt.retryFromAttemptId === failures[0]!.id)?.status).toBe('queued');
  const other = await all.missionControl.goal({ goalId: otherGoal.id });
  expect(other.attempts).toHaveLength(1);
  expect(other.attempts[0]?.status).toBe('failed');
  expect(other.attempts[0]?.failureSummary).toBe(`Recover ${otherGoal.title}`);
  await expect(selected.missionControl.retryExecution({ goalId: otherGoal.id })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  expect(await all.commands.runs.list()).toHaveLength(3);
});

test('reviewed dispatch inherits the facade context when no display scope is supplied', async () => {
  const { all, selected, selectedGoal, otherGoal } = await contextFixture();
  await all.commands.goals.activate(selectedGoal.id);
  await all.commands.goals.activate(otherGoal.id);
  const items = await selected.commands.plan();
  expect(items.map(item => item.goalId)).toEqual([selectedGoal.id]);
  const reserved = await selected.commands.runs.dispatchReviewed({ items });
  expect(reserved.map(item => item.goalId)).toEqual([selectedGoal.id]);
  expect((await all.commands.plan()).map(item => item.goalId)).toEqual([otherGoal.id]);
  const foreign = await all.commands.plan();
  await expect(selected.commands.runs.dispatchReviewed({ items: foreign, executionContextId: 'other-planning-context' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  expect((await all.commands.runs.list()).map(run => run.goalId)).toEqual([selectedGoal.id]);
});
