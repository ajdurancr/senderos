import { expect, test } from 'bun:test';

import { createSenderos } from '../index';
import { createProjectFixture, initHome } from '../test-support/runtime';

test('Mission Control returns an overview and starts a goal through the shared façade', async () => {
  const home = await initHome();
  const senderos = createSenderos({ home });
  const project = await createProjectFixture(home);
  const goal = await senderos.commands.goals.create({
    projectId: project.id,
    title: 'Visualize execution state',
    specText: 'Mission Control shows the active attempt.',
  });

  const started = await senderos.missionControl.startGoal({
    goalId: goal.id,
    workingPath: project.canonicalPath,
  });

  expect(started.goal.status).toBe('active');
  expect(started.attempts).toHaveLength(1);
  expect(started.attempts[0]?.status).toBe('running');
  expect(started.events.some((event) => event.entityId === goal.id)).toBe(true);

  const overview = await senderos.missionControl.overview();
  expect(overview.goals.map((item) => item.id)).toContain(goal.id);
  expect(overview.status.activeAttemptIds).toContain(started.attempts[0]?.id);
  expect(overview.queue.activeRuns.map((run) => run.id)).toContain(
    started.run?.id,
  );
});

test('Mission Control retries a failed execution and stops the new execution', async () => {
  const home = await initHome();
  const senderos = createSenderos({ home });
  const project = await createProjectFixture(home);
  const goal = await senderos.commands.goals.create({
    projectId: project.id,
    title: 'Retry a blocked execution',
  });
  const started = await senderos.missionControl.startGoal({ goalId: goal.id });
  const firstAttempt = started.attempts[0]!;

  await senderos.commands.attempts.update(firstAttempt.id, {
    status: 'failed',
    failureSummary: 'Validation failed.',
  });

  const retried = await senderos.missionControl.retryExecution({ goalId: goal.id });
  expect(retried.attempts).toHaveLength(1);
  expect(retried.attempts[0]?.retryFromAttemptId).toBe(firstAttempt.id);

  const stopped = await senderos.missionControl.stopExecution({
    runId: retried.run.id,
  });
  expect(stopped.run?.status).toBe('canceled');
  expect(stopped.goal.status).toBe('canceled');
});

test('the shared façade exposes every generic command family', async () => {
  const home = await initHome();
  const senderos = createSenderos({ home });
  const project = await senderos.commands.projects.create({
    canonicalPath: (await createProjectFixture(home)).canonicalPath,
    githubOwner: 'ajdurancr',
    githubRepo: 'senderos',
  });
  expect((await senderos.commands.projects.get(project.id))?.id).toBe(project.id);
  expect(await senderos.commands.projects.list()).toHaveLength(2);
  expect(
    (await senderos.commands.projects.update({ id: project.id, name: 'Senderos Core' }))
      ?.name,
  ).toBe('Senderos Core');

  const goal = await senderos.commands.goals.create({
    projectId: project.id,
    title: 'Exercise façade',
  });
  expect((await senderos.commands.goals.get(goal.id))?.id).toBe(goal.id);
  expect(await senderos.commands.goals.list()).toHaveLength(1);
  expect(
    (await senderos.commands.goals.update({ id: goal.id, title: 'Updated façade' }))
      ?.title,
  ).toBe('Updated façade');
  await senderos.commands.goals.activate(goal.id);

  const transition = (await senderos.commands.agents.transitions())[0]!;
  expect(await senderos.commands.agents.list()).not.toHaveLength(0);
  expect((await senderos.commands.plan()).map((item) => item.goalId)).toContain(
    goal.id,
  );
  const dispatched = await senderos.commands.runs.dispatch({
    goalId: goal.id,
    transitionId: transition.id,
    agentId: transition.sourceAgentId,
  });
  expect((await senderos.commands.runs.get(dispatched.runId))?.id).toBe(
    dispatched.runId,
  );
  expect(await senderos.commands.runs.list()).toHaveLength(1);
  expect((await senderos.commands.attempts.get(dispatched.attemptId))?.id).toBe(
    dispatched.attemptId,
  );
  expect(await senderos.commands.attempts.list(dispatched.runId)).toHaveLength(1);
  expect(
    (await senderos.commands.attempts.resume(dispatched.attemptId)).attempt.id,
  ).toBe(dispatched.attemptId);
  await senderos.commands.attempts.update(dispatched.attemptId, {
    checkpoint: 'checked',
  });
  expect(
    (await senderos.commands.attempts.recordEvidence({
      attemptId: dispatched.attemptId,
      kind: 'ci',
      label: 'CI passed',
    })).label,
  ).toBe('CI passed');
  expect(
    (await senderos.commands.attempts.review({
      attemptId: dispatched.attemptId,
      status: 'approved',
      reviewer: 'Studio operator',
    })).status,
  ).toBe('approved');
  expect((await senderos.commands.status()).activeRuns).toBe(1);
  expect((await senderos.commands.runs.cancel(dispatched.runId))?.status).toBe(
    'canceled',
  );
  expect((await senderos.commands.goals.cancel(goal.id))?.status).toBe('canceled');
});
