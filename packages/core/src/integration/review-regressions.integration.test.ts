import { expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { openRuntimeDb } from '../db/client';
import { attemptClaims } from '../db/schema';
import { createProjectFixture, initHome } from '../test-support/runtime';
import { startTestWorker } from '../test-support/worker';
import {
  activateGoal, cancelGoal, claimAttempt, createAgent, createGoal,
  declareHostWorkspace, dispatchRun, getAttempt, getGoal, newSendero,
  goalActivations, plan, publishSendero, reconcileAttempt, registerHost, resumeAttempt,
  reviewRunAttempt, setActivationBudget, setRetryBudget, updateAgent, updateRunAttempt,
} from '../index';

async function runningFixture(requireReview = false, outcome?: string) {
  const home = await initHome();
  const project = await createProjectFixture(home);
  const agent = await createAgent({ home, slug: 'review-worker', name: 'Review worker', instructions: 'Return the configured outcome.' });
  await newSendero({
    home, slug: 'review-graph', name: 'Review graph',
    nodes: [
      { key: 'start', kind: 'start', label: 'Start' },
      { key: 'work', kind: 'agent', label: 'Work', agentId: agent.id, executionObjective: 'Work', completion: { requireReview } },
      { key: 'end', kind: 'end', label: 'End' },
    ],
    edges: [{ source: 'start', target: 'work' }, { source: 'work', target: 'end', condition: outcome ? { outcome } : {} }],
  });
  const graph = (await publishSendero('review-graph', home))!;
  const goal = await createGoal({ home, projectId: project.id, title: 'Independent review regression', senderoVersionId: graph.version.id });
  await activateGoal(goal.id, home);
  const run = await dispatchRun({ goalId: goal.id }, home);
  const claim = await startTestWorker(home, project.id, run.attemptId);
  return { home, project, agent, goal, run, claim };
}

test('a running worker can acknowledge cancellation after its published agent is disabled', async () => {
  const f = await runningFixture();
  await updateAgent({ home: f.home, id: f.agent.id, status: 'disabled' });
  await cancelGoal(f.goal.id, f.home);
  await updateRunAttempt(f.run.attemptId, { token: f.claim.token, status: 'canceled' }, f.home);
  expect((await getGoal(f.goal.id, f.home))!.status).toBe('canceled');
});

test('a running worker can report failure after its published agent is disabled', async () => {
  const f = await runningFixture();
  await updateAgent({ home: f.home, id: f.agent.id, status: 'disabled' });
  expect((await updateRunAttempt(f.run.attemptId, { token: f.claim.token, status: 'failed', failureSummary: 'Stopped after disable' }, f.home)).status).toBe('failed');
});

test('invalid outcomes are rejected before a success request becomes gate-paused', async () => {
  const f = await runningFixture(true, 'accepted');
  await expect(updateRunAttempt(f.run.attemptId, { token: f.claim.token, status: 'succeeded', result: { outcome: 'typo' } }, f.home)).rejects.toMatchObject({ code: 'NO_MATCHING_EDGE' });
  const attempt = (await getAttempt(f.run.attemptId, f.home))!;
  expect(attempt.status).toBe('running');
  expect(JSON.parse(attempt.statusSnapshotJson).completionRequested).toBeUndefined();
  expect(JSON.parse(attempt.resultJson)).toEqual({});
});

test('pending completion cannot restart execution or change the result being reviewed', async () => {
  const f = await runningFixture(true, 'accepted');
  const result = { outcome: 'accepted', summary: 'The result to review' };
  expect((await updateRunAttempt(f.run.attemptId, { token: f.claim.token, status: 'succeeded', result }, f.home)).status).toBe('paused');
  for (const status of ['running', 'paused'] as const) {
    await expect(updateRunAttempt(f.run.attemptId, { token: f.claim.token, status }, f.home)).rejects.toMatchObject({ code: 'COMPLETION_PENDING' });
  }
  await expect(updateRunAttempt(f.run.attemptId, { token: f.claim.token, result: { ...result, summary: 'Unreviewed replacement' } }, f.home)).rejects.toMatchObject({ code: 'RESULT_CONFLICT' });
  expect((await updateRunAttempt(f.run.attemptId, { token: f.claim.token, status: 'succeeded', result }, f.home)).status).toBe('paused');
  const attempt = (await getAttempt(f.run.attemptId, f.home))!;
  expect(JSON.parse(attempt.resultJson)).toEqual(result);
  expect(JSON.parse(attempt.statusSnapshotJson).completionRequested).toBe(true);
  await reviewRunAttempt({ home: f.home, attemptId: f.run.attemptId, status: 'approved', reviewer: 'Reviewer' });
  expect((await getGoal(f.goal.id, f.home))!.status).toBe('completed');
});

test('result and status snapshot updates require JSON objects and leave work unchanged on rejection', async () => {
  const f = await runningFixture();
  for (const field of ['result', 'statusSnapshot'] as const) {
    for (const value of [null, [], 'scalar', 1, false]) {
      await expect(updateRunAttempt(f.run.attemptId, { token: f.claim.token, [field]: value } as never, f.home)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    }
  }
  const attempt = (await getAttempt(f.run.attemptId, f.home))!;
  expect(attempt.status).toBe('running');
  expect(JSON.parse(attempt.resultJson)).toEqual({});
});

test('renewing a started claim preserves recorded session location, harness, and packet', async () => {
  const f = await runningFixture();
  const before = await resumeAttempt(f.run.attemptId, f.home);
  await registerHost({ id: 'test-worker', name: 'Changed host', harness: 'a-different-harness', capabilities: ['shell', 'independent_session'] }, f.home);
  await declareHostWorkspace({ hostId: 'test-worker', projectId: f.project.id, available: true, workingPath: '/different-checkout' }, f.home);
  const renewed = await claimAttempt({ attemptId: f.run.attemptId, ownerId: 'test-worker', token: f.claim.token }, f.home);
  const after = await resumeAttempt(f.run.attemptId, f.home);
  expect(renewed.token).toBe(f.claim.token);
  expect(after.attempt.workingPath).toBe('/test/workspace');
  expect(after.attempt.harness).toBe('deterministic-test');
  expect(after.attempt.externalSessionId).toBe(before.attempt.externalSessionId);
  expect(after.attempt.preflight).toEqual(before.attempt.preflight);
  expect(after.packet).toEqual(before.packet);
});

test('observed-active reclaim preserves a started session after host declarations are withdrawn', async () => {
  const f = await runningFixture();
  const before = await resumeAttempt(f.run.attemptId, f.home);
  await registerHost({ id: 'test-worker', name: 'Changed host', harness: 'a-different-harness', capabilities: [], enabled: false }, f.home);
  await declareHostWorkspace({ hostId: 'test-worker', projectId: f.project.id, available: false, workingPath: '/different-checkout' }, f.home);
  await openRuntimeDb(f.home).update(attemptClaims).set({ leaseExpiresAt: '2000-01-01T00:00:00.000Z' }).where(eq(attemptClaims.attemptId, f.run.attemptId));
  await reconcileAttempt({ attemptId: f.run.attemptId, ownerId: 'test-worker', outcome: 'active', details: 'Observed the original worker session still running', externalSessionId: before.attempt.externalSessionId! }, f.home);
  const reclaimed = await claimAttempt({ attemptId: f.run.attemptId, ownerId: 'test-worker', reclaim: true }, f.home);
  const after = await resumeAttempt(f.run.attemptId, f.home);
  expect(reclaimed.token).not.toBe(f.claim.token);
  expect(after.attempt.workingPath).toBe(before.attempt.workingPath);
  expect(after.attempt.harness).toBe(before.attempt.harness);
  expect(after.attempt.externalSessionId).toBe(before.attempt.externalSessionId);
  expect(after.attempt.preflight).toEqual(before.attempt.preflight);
  expect(after.packet).toEqual(before.packet);
  await expect(updateRunAttempt(f.run.attemptId, { token: f.claim.token, status: 'failed' }, f.home)).rejects.toMatchObject({ code: 'STALE_OWNER' });
  expect((await updateRunAttempt(f.run.attemptId, { token: reclaimed.token, status: 'failed' }, f.home)).status).toBe('failed');
});

for (const source of ['agent', 'node'] as const) {
  test(`capability identifiers impossible for hosts to declare are rejected in ${source} definitions before publication`, async () => {
    const home = await initHome();
    await expect((async () => {
      const agent = await createAgent({ home, slug: 'invalid-caps', name: 'Invalid caps', instructions: 'Work', ...(source === 'agent' ? { defaultMeta: { requiredCapabilities: ['has spaces'] } } : {}) });
      await newSendero({
        home, slug: 'bad-caps', name: 'Bad capabilities',
        nodes: [
          { key: 'start', kind: 'start', label: 'Start' },
          { key: 'work', kind: 'agent', label: 'Work', agentId: agent.id, executionObjective: 'Work', ...(source === 'node' ? { requirements: ['has spaces'] } : {}) },
          { key: 'end', kind: 'end', label: 'End' },
        ],
        edges: [{ source: 'start', target: 'work' }, { source: 'work', target: 'end' }],
      });
      await publishSendero('bad-caps', home);
    })()).rejects.toThrow();
  });
}

for (const budget of ['retries', 'activations'] as const) {
  test(`changing ${budget} on a draft goal cannot implicitly activate it`, async () => {
    const home = await initHome();
    const project = await createProjectFixture(home);
    const goal = await createGoal({ home, projectId: project.id, title: 'Keep this goal draft' });
    await expect(budget === 'retries' ? setRetryBudget(goal.id, 5, home) : setActivationBudget(goal.id, 200, home)).rejects.toMatchObject({ code: 'GOAL_NOT_ACTIVE' });
    expect((await getGoal(goal.id, home))!.status).toBe('draft');
    expect(await plan({ home })).toHaveLength(0);
    expect(await goalActivations(goal.id, home)).toHaveLength(0);
  });
}

test('budget changes cannot resurrect blocked routing while claimed workers acknowledge cancellation', async () => {
  const home = await initHome();
  const project = await createProjectFixture(home);
  const agent = await createAgent({ home, slug: 'cancel-worker', name: 'Cancellation worker', instructions: 'Return the configured outcome.' });
  await newSendero({
    home, slug: 'cancel-budget', name: 'Cancellation and budgets', maxActivations: 2,
    nodes: [
      { key: 'start', kind: 'start', label: 'Start' },
      ...['slow', 'spin'].map(key => ({ key, kind: 'agent' as const, label: key, agentId: agent.id, executionObjective: key })),
      { key: 'end', kind: 'end', label: 'End' },
    ],
    edges: [
      { source: 'start', target: 'slow' }, { source: 'start', target: 'spin' },
      { source: 'slow', target: 'end' },
      { source: 'spin', target: 'spin', condition: { outcome: 'repeat' } },
      { source: 'spin', target: 'end', condition: { outcome: 'done' } },
    ],
  });
  const graph = (await publishSendero('cancel-budget', home))!;
  const goal = await createGoal({ home, projectId: project.id, title: 'Cancel while routing is budget-blocked', senderoVersionId: graph.version.id });
  await activateGoal(goal.id, home);
  const start = async (label: string) => {
    const activations = await goalActivations(goal.id, home);
    const node = graph.nodes.find(node => node.label === label)!;
    const item = (await plan({ home })).find(item => activations.some(activation => activation.id === item.activationId && activation.nodeId === node.id))!;
    const run = await dispatchRun({ goalId: goal.id, activationId: item.activationId }, home);
    const claim = await startTestWorker(home, project.id, run.attemptId);
    return { ...run, token: claim.token };
  };
  const slow = await start('slow');
  const spin = await start('spin');
  await updateRunAttempt(spin.attemptId, { token: spin.token, status: 'succeeded', result: { outcome: 'repeat' } }, home);
  expect((await goalActivations(goal.id, home)).some(activation => activation.reason === 'activation_limit_reached')).toBe(true);
  await cancelGoal(goal.id, home);
  expect((await getGoal(goal.id, home))!.status).toBe('blocked');
  await expect(setActivationBudget(goal.id, 3, home)).rejects.toMatchObject({ code: 'CANCELLATION_REQUESTED' });
  await expect(setRetryBudget(goal.id, 5, home)).rejects.toMatchObject({ code: 'CANCELLATION_REQUESTED' });
  expect(await goalActivations(goal.id, home)).toHaveLength(2);
  expect(await plan({ home })).toHaveLength(0);
  await updateRunAttempt(slow.attemptId, { token: slow.token, status: 'canceled' }, home);
  expect((await getGoal(goal.id, home))!.status).toBe('canceled');
  expect((await goalActivations(goal.id, home)).every(activation => activation.status === 'canceled')).toBe(true);
});

test('publication rejects a cycle that reenters a consumed join without its paired fork', async () => {
  const home = await initHome();
  const agent = await createAgent({ home, slug: 'join-worker', name: 'Join worker', instructions: 'Return an outcome.' });
  await newSendero({
    home, slug: 'consumed-join', name: 'Consumed join',
    nodes: [
      { key: 'start', kind: 'start', label: 'Start' },
      ...['left', 'right', 'join', 'again'].map(key => ({ key, kind: 'agent' as const, label: key, agentId: agent.id, executionObjective: key, ...(key === 'join' ? { joinForkNodeId: 'start' } : {}) })),
      { key: 'end', kind: 'end', label: 'End' },
    ],
    edges: [
      { source: 'start', target: 'left' }, { source: 'start', target: 'right' },
      { source: 'left', target: 'join' }, { source: 'right', target: 'join' },
      { source: 'join', target: 'again', condition: { outcome: 'repeat' } },
      { source: 'again', target: 'join' },
      { source: 'join', target: 'end', condition: { outcome: 'done' } },
    ],
  });
  await expect(publishSendero('consumed-join', home)).rejects.toMatchObject({ code: 'INVALID_JOIN' });
});

test('publication rejects crossed nested join consumption even when both forks dominate their joins', async () => {
  const home = await initHome();
  const agent = await createAgent({ home, slug: 'crossed-worker', name: 'Crossed worker', instructions: 'Return an outcome.' });
  await newSendero({
    home, slug: 'crossed-joins', name: 'Crossed joins',
    nodes: [
      { key: 'start', kind: 'start', label: 'Start' },
      ...['outer', 'inner', 'left', 'right', 'outerJoin', 'innerJoin'].map(key => ({ key, kind: 'agent' as const, label: key, agentId: agent.id, executionObjective: key, ...(key === 'outerJoin' ? { joinForkNodeId: 'outer' } : key === 'innerJoin' ? { joinForkNodeId: 'inner' } : {}) })),
      { key: 'end', kind: 'end', label: 'End' },
    ],
    edges: [
      ['start', 'outer'], ['outer', 'inner'], ['outer', 'end'],
      ['inner', 'left'], ['inner', 'right'], ['left', 'outerJoin'], ['right', 'outerJoin'],
      ['outerJoin', 'innerJoin'], ['innerJoin', 'end'],
    ].map(([source, target]) => ({ source: source!, target: target! })),
  });
  await expect(publishSendero('crossed-joins', home)).rejects.toMatchObject({ code: 'INVALID_JOIN' });
});

for (const innerArrivals of [0, 1]) {
  test(`nested paired forks retain successful exits with ${innerArrivals} inner arrivals`, async () => {
    const home = await initHome();
    const project = await createProjectFixture(home);
    const agent = await createAgent({ home, slug: 'nested-worker', name: 'Nested worker', instructions: 'Return an outcome.' });
    await newSendero({
      home, slug: 'nested-exits', name: 'Nested exits',
      nodes: [
        { key: 'start', kind: 'start', label: 'Start' },
        ...['outer', 'inner', 'left', 'right', 'sibling', 'outerJoin', 'innerJoin'].map(key => ({ key, kind: 'agent' as const, label: key, agentId: agent.id, executionObjective: key, ...(key === 'outerJoin' ? { joinForkNodeId: 'outer' } : key === 'innerJoin' ? { joinForkNodeId: 'inner' } : {}) })),
        { key: 'end', kind: 'end', label: 'End' },
      ],
      edges: [
        ...[['start', 'outer'], ['outer', 'inner'], ['outer', 'sibling'], ['inner', 'left'], ['inner', 'right'], ['sibling', 'outerJoin'], ['innerJoin', 'outerJoin'], ['outerJoin', 'end']].map(([source, target]) => ({ source: source!, target: target! })),
        ...['left', 'right'].flatMap(source => [{ source, target: 'innerJoin', condition: { outcome: 'arrive' } }, { source, target: 'end', condition: { outcome: 'exit' } }]),
      ],
    });
    const graph = (await publishSendero('nested-exits', home))!;
    const goal = await createGoal({ home, projectId: project.id, title: 'Nested exits', senderoVersionId: graph.version.id });
    await activateGoal(goal.id, home);
    const finish = async (label: string, outcome?: string) => {
      const node = graph.nodes.find(node => node.label === label)!;
      const activations = await goalActivations(goal.id, home);
      const item = (await plan({ home })).find(item => activations.some(activation => activation.id === item.activationId && activation.nodeId === node.id))!;
      expect(item).toBeDefined();
      const run = await dispatchRun({ goalId: goal.id, activationId: item.activationId }, home);
      const claim = await startTestWorker(home, project.id, run.attemptId);
      await updateRunAttempt(run.attemptId, { token: claim.token, status: 'succeeded', result: outcome ? { outcome } : {} }, home);
      return claim.packet;
    };
    await finish('outer'); await finish('inner'); await finish('sibling');
    await finish('left', innerArrivals ? 'arrive' : 'exit');
    await finish('right', 'exit');
    if (innerArrivals) expect((await finish('innerJoin')).activation.input.arrivals).toHaveLength(1);
    else expect((await goalActivations(goal.id, home)).some(activation => activation.nodeId === graph.nodes.find(node => node.label === 'innerJoin')!.id)).toBe(false);
    expect((await finish('outerJoin')).activation.input.arrivals).toHaveLength(innerArrivals + 1);
    expect((await getGoal(goal.id, home))!.status).toBe('completed');
  });
}
