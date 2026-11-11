import { startTestWorker } from '../test-support/worker';
import { expect, test, spyOn } from 'bun:test';
import { eq } from 'drizzle-orm';
import { openRuntimeDb } from '../db/client';
import { runs, runAttempts } from '../db/schema';

import { createSenderos, createAgent, newSendero, publishSendero } from '../index';
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
  expect(started.attempts[0]?.status).toBe('queued');
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

  const claim = await startTestWorker(home, project.id, firstAttempt.id);
  await senderos.commands.attempts.update(firstAttempt.id, {
    token: claim.token,
    status: 'failed',
    failureSummary: 'Validation failed.',
  });

  expect((await senderos.missionControl.overview()).queue.failedAttempts.map(item => item.id)).toEqual([firstAttempt.id]);
  expect((await createSenderos({ home, executionContextId: 'unrelated' }).missionControl.overview()).queue.failedAttempts).toEqual([]);
  // Legacy cursors can identify the latest run before the run row gains its activation ID.
  await openRuntimeDb(home).update(runs).set({ activationId: null }).where(eq(runs.id, firstAttempt.runId));
  expect((await senderos.missionControl.overview()).queue.failedAttempts.map(item => item.id)).toEqual([firstAttempt.id]);
  const retried = await senderos.missionControl.retryExecution({ goalId: goal.id });
  const recovery = await senderos.missionControl.overview();
  expect(recovery.queue.failedAttempts).toHaveLength(0);
  expect(recovery.attempts.find(item => item.id === firstAttempt.id)?.status).toBe('failed');
  expect(retried.attempts).toHaveLength(1);
  expect(retried.attempts[0]?.retryFromAttemptId).toBe(firstAttempt.id);

  const stopped = await senderos.missionControl.stopExecution({
    runId: retried.run.id,
  });
  expect(stopped.run?.status).toBe('canceled');
  expect(stopped.goal.status).toBe('canceled');
});

test('failed attention follows each parallel activation through retries and cancellation', async () => {
  const home = await initHome();
  const senderos = createSenderos({ home });
  const project = await createProjectFixture(home);
  const agent = await createAgent({ home, slug: 'attention-worker', name: 'Attention worker', instructions: 'Report isolated outcomes.' });
  await newSendero({ home, slug: 'attention-parallel', name: 'Parallel attention', nodes: [
    { key: 'start', kind: 'start', label: 'Start' },
    ...['left', 'right'].map(key => ({ key, kind: 'agent' as const, label: key, agentId: agent.id, executionObjective: key })),
    { key: 'end', kind: 'end', label: 'End' },
  ], edges: [['start', 'left'], ['start', 'right'], ['left', 'end'], ['right', 'end']].map(([source, target]) => ({ source, target })) });
  const graph = (await publishSendero('attention-parallel', home))!;
  const goal = await senderos.commands.goals.create({ projectId: project.id, title: 'Recover parallel work', senderoVersionId: graph.version.id });
  await senderos.commands.goals.activate(goal.id);
  const reserve = async (activationId: string) => senderos.commands.runs.dispatch({ goalId: goal.id, activationId });
  const fail = async (attemptId: string) => {
    const claim = await startTestWorker(home, project.id, attemptId);
    await senderos.commands.attempts.update(attemptId, { token: claim.token, status: 'failed', failureSummary: 'Needs recovery.' });
  };
  const items = await senderos.commands.plan();
  const left = await reserve(items[0]!.activationId);
  const right = await reserve(items[1]!.activationId);
  await fail(left.attemptId);
  await fail(right.attemptId);
  const failedIds = async () => (await senderos.missionControl.overview()).queue.failedAttempts.map(item => item.id).sort();
  expect(await failedIds()).toEqual([left.attemptId, right.attemptId].sort());
  const retry = await reserve(items[0]!.activationId);
  expect(await failedIds()).toEqual([right.attemptId]);
  await fail(retry.attemptId);
  expect(await failedIds()).toEqual([retry.attemptId, right.attemptId].sort());
  const final = await reserve(items[0]!.activationId);
  const claim = await startTestWorker(home, project.id, final.attemptId);
  await senderos.commands.attempts.update(final.attemptId, { token: claim.token, status: 'succeeded' });
  expect(await failedIds()).toEqual([right.attemptId]);
  await senderos.commands.goals.cancel(goal.id);
  const canceled = await senderos.missionControl.overview();
  expect(canceled.queue.failedAttempts).toHaveLength(0);
  expect(canceled.attempts.filter(item => item.status === 'failed')).toHaveLength(3);
});

test('failed attention retains unexplained failures but honors a newer attempt in a legacy run', async () => {
  const home = await initHome();
  const senderos = createSenderos({ home });
  const project = await createProjectFixture(home);
  const goal = await senderos.commands.goals.create({ projectId: project.id, title: 'Legacy attempt history' });
  const started = await senderos.missionControl.startGoal({ goalId: goal.id });
  const attempt = started.attempts[0]!;
  const claim = await startTestWorker(home, project.id, attempt.id);
  await senderos.commands.attempts.update(attempt.id, { token: claim.token, status: 'failed' });
  const db = openRuntimeDb(home);
  // A missing association is an unexplained state, never evidence of recovery.
  await db.update(runs).set({ activationId: 'missing-activation' }).where(eq(runs.id, attempt.runId));
  expect((await senderos.missionControl.overview()).queue.failedAttempts.map(item => item.id)).toEqual([attempt.id]);
  const original = (await db.select().from(runAttempts).where(eq(runAttempts.id, attempt.id)))[0]!;
  await db.insert(runAttempts).values({ ...original, id: `${attempt.id}-newer`, attemptNumber: 2, status: 'queued' });
  const overview = await senderos.missionControl.overview();
  expect(overview.queue.failedAttempts).toEqual([]);
  expect(overview.attempts.find(item => item.id === attempt.id)?.status).toBe('failed');
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

  const planned = (await senderos.commands.plan())[0]!;
  const transition = { id: planned.transitionId, sourceAgentId: planned.agentId };
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
  const claim = await startTestWorker(home, project.id, dispatched.attemptId);
  await senderos.commands.attempts.update(dispatched.attemptId, {
    token: claim.token,
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
  expect((await senderos.commands.runs.cancel(dispatched.runId))?.status).toBe('executing');
  expect((await senderos.commands.goals.get(goal.id))?.status).toBe('blocked');
  await senderos.commands.attempts.update(dispatched.attemptId, { token: claim.token, status: 'canceled' });
  expect((await senderos.commands.goals.cancel(goal.id))?.status).toBe('canceled');
});


test('overview derives its dispatch queue from one lifecycle explanation per goal', async () => {
  const home = await initHome();
  const senderos = createSenderos({ home });
  const project = await createProjectFixture(home);
  const draft = await senderos.commands.goals.create({ projectId: project.id, title: 'Still a draft' });
  const ready = await senderos.commands.goals.create({ projectId: project.id, title: 'Ready for dispatch' });
  // The runtime fixture binds the published workflow through startGoal.
  const running = await senderos.commands.goals.create({ projectId: project.id, title: 'Reserved work' });
  await senderos.missionControl.startGoal({ goalId: running.id });
  const started = await senderos.missionControl.startGoal({ goalId: ready.id });
  const first = started.attempts[0]!;
  const claim = await startTestWorker(home, project.id, first.id);
  await senderos.commands.attempts.update(first.id, { token: claim.token, status: 'failed', failureSummary: 'Retain recovery facts' });
  const expectedPlan = await senderos.commands.plan();
  const expectedStatus = await senderos.commands.status();
  const client = openRuntimeDb(home).$client;
  const prototype = Object.getPrototypeOf(client);
  const execute = prototype.execute;
  let explanations = 0;
  const spy = spyOn(prototype, 'execute').mockImplementation(function(this: unknown, statement: unknown, ...rest: unknown[]) {
    if (statement === 'BEGIN IMMEDIATE') explanations++;
    return execute.call(this, statement, ...rest);
  });
  let overview;
  try { overview = await senderos.missionControl.overview(); }
  finally { spy.mockRestore(); client.close(); }
  expect(overview.goals.map(goal => goal.id)).toEqual([draft.id, ready.id, running.id]);
  expect(overview.queue.dispatchable).toEqual(expectedPlan);
  expect(overview.status).toEqual(expectedStatus);
  expect(overview.queue.failedAttempts.map(attempt => attempt.id)).toContain(first.id);
  expect(overview.attempts.find(attempt => attempt.id === first.id)?.failureSummary).toBe('Retain recovery facts');
  expect(explanations).toBe(overview.goals.length);
});
