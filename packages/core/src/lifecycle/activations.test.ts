import { expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { initHome, createProjectFixture } from '../test-support/runtime';
import { startTestWorker } from '../test-support/worker';
import { createAgent, newSendero, publishSendero, createGoal, activateGoal, plan, dispatchRun, updateRunAttempt, getGoal, explainGoal, setActivationBudget, cancelGoal, recordAttemptEvidence } from '../index';
import { goalActivations, activationForRun } from './activations';
import { openRuntimeDb } from '../db/client';
import { forkGenerations, activations } from '../db/schema';
import type { SenderoDefinitionInput } from '../commands/senderos/create';

async function fixture(edges: Array<[string, string, string?]>, joins: Record<string, string> = {}, budget = 100) {
  const home = await initHome(), project = await createProjectFixture(home);
  const agent = await createAgent({ home, slug: 'graph-worker', name: 'Graph worker', instructions: 'Return the requested deterministic outcome.' });
  const keys = [...new Set(edges.flatMap(e => e.slice(0, 2) as string[]))];
  const nodes: NonNullable<SenderoDefinitionInput['nodes']> = keys.map(key => ({ key, kind: key === 'start' ? 'start' : key === 'end' ? 'end' : 'agent', label: key, ...(key !== 'start' && key !== 'end' ? { agentId: agent.id, executionObjective: key, joinForkNodeId: joins[key] } : {}) }));
  await newSendero({ home, slug: 'graph', name: 'Graph', maxActivations: budget, nodes, edges: edges.map(([source, target, outcome]) => ({ source, target, condition: outcome ? { outcome } : {} })) });
  const graph = (await publishSendero('graph', home))!;
  const goal = await createGoal({ home, projectId: project.id, title: 'Graph execution', senderoVersionId: graph.version.id });
  await activateGoal(goal.id, home);
  const planned = async (label: string) => { const node = graph.nodes.find(n => n.label === label)!; const values = await goalActivations(goal.id, home); return (await plan({ home })).find(p => values.some(a => a.id === p.activationId && a.nodeId === node.id))!; };
  const start = async (label: string) => { const item = await planned(label); expect(item).toBeDefined(); const run = await dispatchRun({ ...item, previousRunId: item.previousRunId ?? undefined, expectedRevision: item.revision }, home); const claim = await startTestWorker(home, project.id, run.attemptId); return { ...run, token: claim.token, packet: claim.packet }; };
  const finish = async (label: string, outcome?: string) => { const run = await start(label); await updateRunAttempt(run.attemptId, { status: 'succeeded', token: run.token, result: outcome ? { outcome } : {} }, home); return run; };
  return { home, goal, graph, project, planned, start, finish };
}
test('conditional backedges create new activations, enforce finite budget, and preserve successful results', async () => {
  const f = await fixture([['start', 'a'], ['a', 'b'], ['b', 'a', 'revise'], ['b', 'end', 'accepted']], {}, 2);
  await f.finish('a'); const b = await f.start('b');
  await expect(updateRunAttempt(b.attemptId, { status: 'succeeded', token: b.token, result: { outcome: 'unknown' } }, f.home)).rejects.toMatchObject({ code: 'NO_MATCHING_EDGE' });
  await updateRunAttempt(b.attemptId, { status: 'succeeded', token: b.token, result: { outcome: 'revise' } }, f.home);
  expect((await explainGoal(f.goal.id, f.home)).reason).toBe('activation_limit_reached');
  expect(await plan({ home: f.home })).toHaveLength(0);
  await expect(setActivationBudget(f.goal.id, 1, f.home)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  await setActivationBudget(f.goal.id, 4, f.home);
  await updateRunAttempt(b.attemptId, { status: 'succeeded', token: b.token, result: { outcome: 'revise' } }, f.home);
  expect(await goalActivations(f.goal.id, f.home)).toHaveLength(3);
  const secondA = await f.finish('a'); expect((await activationForRun(secondA.runId, f.home))!.id).not.toBe((await goalActivations(f.goal.id, f.home))[0]!.id);
  await f.finish('b', 'accepted'); expect((await getGoal(f.goal.id, f.home))!.status).toBe('completed');
  await expect(setActivationBudget(f.goal.id, 5, f.home)).rejects.toMatchObject({ code: 'TERMINAL_GOAL' });
});
test('explicit join waits for selected descendants, permits successful exit, aggregates evidence, and runs once', async () => {
  const f = await fixture([['start', 'fork'], ['fork', 'left'], ['fork', 'right'], ['left', 'join'], ['right', 'join', 'arrive'], ['right', 'end', 'exit'], ['join', 'end']], { join: 'fork' });
  await f.finish('fork'); expect(await plan({ home: f.home })).toHaveLength(2);
  await expect(dispatchRun({ goalId: f.goal.id }, f.home)).rejects.toMatchObject({ code: 'ACTIVATION_REQUIRED' });
  const left = await f.start('left'); await recordAttemptEvidence({ home: f.home, attemptId: left.attemptId, kind: 'artifact', label: 'Left evidence', summary: 'deterministic' });
  await updateRunAttempt(left.attemptId, { token: left.token, status: 'succeeded', result: { branch: 'left' } }, f.home);
  expect(await f.planned('join')).toBeUndefined();
  const failure = await f.start('right'); await updateRunAttempt(failure.attemptId, { token: failure.token, status: 'failed' }, f.home);
  expect(await f.planned('join')).toBeUndefined();
  await f.finish('right', 'exit');
  const join = await f.start('join'); expect(join.packet.activation.input.arrivals).toHaveLength(1);
  expect(join.packet.activation.input.arrivals[0].previous.snapshot.evidence[0].label).toBe('Left evidence');
  await Promise.all([1, 2].map(() => updateRunAttempt(join.attemptId, { token: join.token, status: 'succeeded' }, f.home)));
  expect((await getGoal(f.goal.id, f.home))!.status).toBe('completed');
  expect((await goalActivations(f.goal.id, f.home)).filter(a => a.nodeId === f.graph.nodes.find(n => n.label === 'join')!.id && a.latestRunId)).toHaveLength(1);
});
test('nested paired forks settle inner join before outer join without mixing arrivals', async () => {
  const f = await fixture([['start', 'outer'], ['outer', 'left'], ['outer', 'right'], ['left', 'x'], ['left', 'y'], ['x', 'inner'], ['y', 'inner'], ['inner', 'final'], ['right', 'final'], ['final', 'end']], { inner: 'left', final: 'outer' });
  await f.finish('outer'); await f.finish('left'); await f.finish('right'); await f.finish('x');
  expect(await f.planned('final')).toBeUndefined(); expect(await f.planned('inner')).toBeUndefined();
  await f.finish('y'); const inner = await f.finish('inner'); expect(inner.packet.activation.input.arrivals).toHaveLength(2);
  const final = await f.finish('final'); expect(final.packet.activation.input.arrivals).toHaveLength(2);
  expect((await getGoal(f.goal.id, f.home))!.status).toBe('completed');
});
test('a selected branch may fan out into multiple arrivals and a cycle creates a fresh fork generation', async () => {
  const f = await fixture([['start', 'fork'], ['fork', 'left'], ['fork', 'right'], ['left', 'x'], ['left', 'y'], ['x', 'join'], ['y', 'join'], ['right', 'join'], ['join', 'fork', 'repeat'], ['join', 'end', 'done']], { join: 'fork' });
  const generations: string[] = [];
  for (const outcome of ['repeat', 'done']) {
    await f.finish('fork'); await f.finish('left'); await f.finish('x'); await f.finish('right'); expect(await f.planned('join')).toBeUndefined(); await f.finish('y');
    const run = await f.finish('join', outcome); expect(run.packet.activation.input.arrivals).toHaveLength(3); generations.push(run.packet.activation.input.forkGenerationId);
  }
  expect(new Set(generations).size).toBe(2); expect((await getGoal(f.goal.id, f.home))!.status).toBe('completed');
});
test('unselected branches do not deadlock joins and zero arrivals do not invent a join execution', async () => {
  const f = await fixture([['start', 'fork'], ['fork', 'left', 'left'], ['fork', 'right', 'right'], ['left', 'join'], ['right', 'end'], ['join', 'end']], { join: 'fork' });
  await f.finish('fork', 'right'); await f.finish('right');
  expect((await getGoal(f.goal.id, f.home))!.status).toBe('completed');
  expect((await goalActivations(f.goal.id, f.home)).some(a => a.nodeId === f.graph.nodes.find(n => n.label === 'join')!.id)).toBe(false);
  expect((await openRuntimeDb(f.home).select().from(forkGenerations))[0]!.status).toBe('closed');
});
test('ordinary convergence remains an independent visit for every arrival', async () => {
  const f = await fixture([['start', 'left'], ['start', 'right'], ['left', 'common'], ['right', 'common'], ['common', 'end']]);
  await f.finish('left'); await f.finish('right');
  expect(await plan({ home: f.home })).toHaveLength(2);
  await f.finish('common'); expect((await getGoal(f.goal.id, f.home))!.status).toBe('active'); await f.finish('common'); expect((await getGoal(f.goal.id, f.home))!.status).toBe('completed');
});
test('cancel waits for every claimed worker and cancels ready or waiting sibling activations', async () => {
  const f = await fixture([['start', 'fork'], ['fork', 'left'], ['fork', 'right'], ['left', 'join'], ['right', 'join'], ['join', 'end']], { join: 'fork' });
  await f.finish('fork'); const left = await f.start('left'), right = await f.start('right');
  await cancelGoal(f.goal.id, f.home); expect(await plan({ home: f.home })).toHaveLength(0);
  await updateRunAttempt(left.attemptId, { token: left.token, status: 'canceled' }, f.home); expect((await getGoal(f.goal.id, f.home))!.status).toBe('blocked');
  await updateRunAttempt(right.attemptId, { token: right.token, status: 'canceled' }, f.home); expect((await getGoal(f.goal.id, f.home))!.status).toBe('canceled');
});
test('reentering a paired fork before its join creates nested generations instead of mixing visits', async () => {
  const f = await fixture([['start', 'fork'], ['fork', 'left'], ['fork', 'right'], ['left', 'fork', 'recurse'], ['left', 'join', 'done'], ['right', 'join'], ['join', 'end']], { join: 'fork' });
  await f.finish('fork'); await f.finish('right'); await f.finish('left', 'recurse');
  await f.finish('fork'); await f.finish('right'); await f.finish('left', 'done');
  const inner = await f.finish('join'); expect(inner.packet.activation.input.arrivals).toHaveLength(2);
  const outer = await f.finish('join'); expect(outer.packet.activation.input.arrivals).toHaveLength(1);
  expect(inner.packet.activation.input.forkGenerationId).not.toBe(outer.packet.activation.input.forkGenerationId);
  expect((await getGoal(f.goal.id, f.home))!.status).toBe('completed');
});
