import { expect, test } from 'bun:test';

import { createSenderos } from '../index';
import { createProjectFixture, initHome } from '../test-support/runtime';

test('Mission Control returns an overview and starts a goal through the shared façade', () => {
  const home = initHome();
  const senderos = createSenderos({ home });
  const project = createProjectFixture(home);
  const goal = senderos.commands.goals.create({
    projectId: project.id,
    title: 'Visualize execution state',
    specText: 'Mission Control shows the active attempt.',
  });

  const started = senderos.missionControl.startGoal({
    goalId: goal.id,
    workingPath: project.canonicalPath,
  });

  expect(started.goal.status).toBe('active');
  expect(started.attempts).toHaveLength(1);
  expect(started.attempts[0]?.status).toBe('running');
  expect(started.events.some((event) => event.entityId === goal.id)).toBe(true);

  const overview = senderos.missionControl.overview();
  expect(overview.goals.map((item) => item.id)).toContain(goal.id);
  expect(overview.status.activeAttemptIds).toContain(started.attempts[0]?.id);
  expect(overview.queue.activeRuns.map((run) => run.id)).toContain(
    started.run?.id,
  );
});

test('Mission Control retries a failed execution and stops the new execution', () => {
  const home = initHome();
  const senderos = createSenderos({ home });
  const project = createProjectFixture(home);
  const goal = senderos.commands.goals.create({
    projectId: project.id,
    title: 'Retry a blocked execution',
  });
  const started = senderos.missionControl.startGoal({ goalId: goal.id });
  const firstAttempt = started.attempts[0]!;

  senderos.commands.attempts.update(firstAttempt.id, {
    status: 'failed',
    failureSummary: 'Validation failed.',
  });

  const retried = senderos.missionControl.retryExecution({ goalId: goal.id });
  expect(retried.attempts).toHaveLength(1);
  expect(retried.attempts[0]?.retryFromAttemptId).toBe(firstAttempt.id);

  const stopped = senderos.missionControl.stopExecution({
    runId: retried.run.id,
  });
  expect(stopped.run?.status).toBe('canceled');
  expect(stopped.goal.status).toBe('canceled');
});

test('the shared façade exposes every generic command family', () => {
  const home = initHome();
  const senderos = createSenderos({ home });
  const project = senderos.commands.projects.create({
    canonicalPath: createProjectFixture(home).canonicalPath,
    githubOwner: 'ajdurancr',
    githubRepo: 'senderos',
  });
  expect(senderos.commands.projects.get(project.id)?.id).toBe(project.id);
  expect(senderos.commands.projects.list()).toHaveLength(2);
  expect(
    senderos.commands.projects.update({ id: project.id, name: 'Senderos Core' })
      ?.name,
  ).toBe('Senderos Core');

  const goal = senderos.commands.goals.create({
    projectId: project.id,
    title: 'Exercise façade',
  });
  expect(senderos.commands.goals.get(goal.id)?.id).toBe(goal.id);
  expect(senderos.commands.goals.list()).toHaveLength(1);
  expect(
    senderos.commands.goals.update({ id: goal.id, title: 'Updated façade' })
      ?.title,
  ).toBe('Updated façade');
  senderos.commands.goals.activate(goal.id);

  const transition = senderos.commands.agents.transitions()[0]!;
  expect(senderos.commands.agents.list()).not.toHaveLength(0);
  expect(senderos.commands.plan().map((item) => item.goalId)).toContain(
    goal.id,
  );
  const dispatched = senderos.commands.runs.dispatch({
    goalId: goal.id,
    transitionId: transition.id,
    agentId: transition.sourceAgentId,
  });
  expect(senderos.commands.runs.get(dispatched.runId)?.id).toBe(
    dispatched.runId,
  );
  expect(senderos.commands.runs.list()).toHaveLength(1);
  expect(senderos.commands.attempts.get(dispatched.attemptId)?.id).toBe(
    dispatched.attemptId,
  );
  expect(senderos.commands.attempts.list(dispatched.runId)).toHaveLength(1);
  expect(
    senderos.commands.attempts.resume(dispatched.attemptId).attempt.id,
  ).toBe(dispatched.attemptId);
  senderos.commands.attempts.update(dispatched.attemptId, {
    checkpoint: 'checked',
  });
  expect(
    senderos.commands.attempts.recordEvidence({
      attemptId: dispatched.attemptId,
      kind: 'ci',
      label: 'CI passed',
    }).label,
  ).toBe('CI passed');
  expect(
    senderos.commands.attempts.review({
      attemptId: dispatched.attemptId,
      status: 'approved',
      reviewer: 'Studio operator',
    }).status,
  ).toBe('approved');
  expect(senderos.commands.status().activeRuns).toBe(1);
  expect(senderos.commands.runs.cancel(dispatched.runId)?.status).toBe(
    'canceled',
  );
  expect(senderos.commands.goals.cancel(goal.id)?.status).toBe('canceled');
});
