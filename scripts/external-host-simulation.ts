import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { WorkerSession } from '../examples/external-host/controller';
import { invokeCli, successfulCli, type HostContext } from '../examples/external-host/protocol';

type Json = Record<string, any>;
type Node = { key: string; kind: 'start' | 'agent' | 'end'; label: string; agentSlug?: string; executionObjective?: string; requirements?: string[]; completion?: Json; joinForkNodeId?: string };
type Edge = { source: string; target: string; condition?: { outcome: string } };

const args = process.argv.slice(2);
const option = (name: string) => { const index = args.indexOf(name); return index < 0 ? undefined : args[index + 1]; };
const keep = args.includes('--keep');
const runtimeParent = resolve(option('--runtime-root') ?? process.env.SENDEROS_TEST_RUNTIME_ROOT ?? tmpdir());
mkdirSync(runtimeParent, { recursive: true });
const runtime = mkdtempSync(join(runtimeParent, 'senderos-external-host-'));
const reportPath = option('--output') ? resolve(option('--output')!) : undefined;
const scenarios: Array<{ name: string; assertions: number; details: Json; elapsedMs: number }> = [];
const sessions: WorkerSession[] = [];
let currentScenario = 'setup';
let assertionCount = 0;
let cliProcesses = 0;
const startedAt = Date.now();
const contexts: HostContext[] = [
  { id: 'context-laptop-codex', hostId: 'host-laptop-codex', name: 'Simulated laptop / Codex', harness: 'simulated-codex', home: join(runtime, 'laptop-codex/home'), workspace: join(runtime, 'laptop-codex/workspace'), marker: 'private workspace: laptop-codex' },
  { id: 'context-laptop-cursor', hostId: 'host-laptop-cursor', name: 'Simulated laptop / Cursor', harness: 'simulated-cursor', home: join(runtime, 'laptop-cursor/home'), workspace: join(runtime, 'laptop-cursor/workspace'), marker: 'private workspace: laptop-cursor' },
  { id: 'context-vps-shell', hostId: 'host-vps-shell', name: 'Simulated VPS / shell', harness: 'simulated-shell', home: join(runtime, 'vps-shell/home'), workspace: join(runtime, 'vps-shell/workspace'), marker: 'private workspace: vps-shell' },
];
const [owner, browser, server] = contexts as [HostContext, HostContext, HostContext];
const databaseUrl = `file:${join(owner.home, 'senderos.db')}`;
let projectId: string;
let sequence = 0;

function check(condition: unknown, message: string): asserts condition {
  assertionCount++;
  assert.ok(condition, `${currentScenario}: ${message}`);
}
function equal(actual: unknown, expected: unknown, message: string) {
  assertionCount++;
  assert.deepEqual(actual, expected, `${currentScenario}: ${message}`);
}
async function cli(context: HostContext, command: string[]): Promise<any> {
  cliProcesses++;
  return successfulCli(context.home, databaseUrl, command);
}
async function raw(context: HostContext, command: string[]) {
  cliProcesses++;
  return invokeCli(context.home, databaseUrl, command);
}
async function rejected(context: HostContext, command: string[], code?: string) {
  const response = await raw(context, command);
  check(response.exitCode !== 0, `${command[0]} ${command[1]} must reject`);
  if (code) equal(response.value.code, code, 'structured rejection code');
  return response.value;
}
async function scenario(name: string, body: () => Promise<Json | void>) {
  currentScenario = name;
  const before = assertionCount;
  const started = Date.now();
  const details = await body() ?? {};
  scenarios.push({ name, assertions: assertionCount - before, details, elapsedMs: Date.now() - started });
}
function node(key: string, extra: Partial<Node> = {}): Node {
  return { key, kind: 'agent', label: key, agentSlug: 'deterministic-worker', executionObjective: `Complete ${key}`, requirements: ['shell'], ...extra };
}
async function graph(slug: string, nodes: Node[], edges: Edge[], maxActivations = 100) {
  const path = join(runtime, `${slug}.json`);
  writeFileSync(path, JSON.stringify({ slug, name: slug, maxActivations, nodes: [{ key: 'start', kind: 'start', label: 'Start' }, ...nodes, { key: 'end', kind: 'end', label: 'End' }], edges }, null, 2));
  const draft = await cli(owner, ['sendero', 'import', '--file', path]);
  check(draft.version.status === 'draft', 'import creates a draft');
  const published = await cli(owner, ['sendero', 'publish', slug]);
  check(published.version.status === 'published', 'publication succeeds');
  return published;
}
async function goal(definition: Json, title: string) {
  const created = await cli(owner, ['goal', 'create', '--id', `simulation-goal-${++sequence}`, '--project-id', projectId, '--title', title, '--spec-text', 'Deterministic external-host acceptance test; no external services or model execution.', '--sendero-version-id', definition.version.id]);
  await cli(owner, ['goal', 'activate', created.id]);
  return created.id as string;
}
async function ready(goalId: string): Promise<Json[]> {
  return (await cli(owner, ['plan'])).filter((item: Json) => item.goalId === goalId);
}
function dispatchArguments(goalId: string, item: Json, requestId = `dispatch-${++sequence}`) {
  return ['run', 'dispatch', '--goal-id', goalId, '--activation-id', item.activationId, '--request-id', requestId, '--expected-revision', String(item.revision)];
}
async function dispatch(goalId: string, activationId?: string) {
  const plans = await ready(goalId);
  const item = activationId ? plans.find(item => item.activationId === activationId) : plans[0];
  check(item, 'expected an eligible activation');
  check(typeof item.activationId === 'string', 'planning identifies a durable activation');
  const command = dispatchArguments(goalId, item);
  const reservation = await cli(owner, command);
  return { ...reservation, activationId: item.activationId, command };
}
async function claim(reservation: Json, context = owner, leaseSeconds = 120) {
  return cli(context, ['attempt', 'claim', reservation.attemptId, '--owner-id', context.hostId, '--lease-seconds', String(leaseSeconds)]);
}
async function worker(reservation: Json, ownership: Json, context = owner, result: Json = { outcome: 'accepted' }, skipStartReportForCrashSimulation = false) {
  const session = new WorkerSession({ home: context.home, databaseUrl, attemptId: reservation.attemptId, token: ownership.token, hostId: context.hostId, sessionId: `worker-${reservation.attemptId}`, parentSessionId: `controller-${process.pid}`, workspace: context.workspace, expectedMarker: context.marker, result, skipStartReportForCrashSimulation });
  sessions.push(session);
  const started = await session.next('started');
  check(started.pid !== process.pid, 'worker is a different operating-system process');
  check(started.sessionId !== started.parentSessionId, 'worker session differs from parent');
  equal(started.workspace, context.workspace, 'worker uses the executing host workspace');
  equal(started.marker, context.marker, 'worker verifies only its own local checkout');
  return session;
}
async function execute(goalId: string, context = owner, result: Json = { outcome: 'accepted' }) {
  const reservation = await dispatch(goalId);
  const ownership = await claim(reservation, context);
  const session = await worker(reservation, ownership, context, result);
  const finished = await session.request('finish', 'finished');
  await session.process.exited;
  return { reservation, ownership, session, finished };
}
async function state(goalId: string) { return cli(owner, ['goal', 'explain', goalId]); }
async function completed(goalId: string) { equal((await state(goalId)).state, 'completed', 'goal completes only after all required work'); }
async function expired(leases: Json[]) {
  const deadline = Math.max(...leases.map(lease => Date.parse(lease.leaseExpiresAt)));
  await Bun.sleep(Math.max(0, deadline - Date.now()) + 150);
}

try {
  await scenario('isolated-host-bootstrap', async () => {
    for (const context of contexts) {
      mkdirSync(context.workspace, { recursive: true });
      writeFileSync(join(context.workspace, 'host-local.txt'), context.marker);
      cliProcesses++;
      await successfulCli(context.home, `file:${join(context.home, 'senderos.db')}`, ['init', '--name', context.name, '--execution-context-id', context.id, '--harness', context.harness, '--approve']);
      await cli(context, ['host', 'context-register', '--name', context.name]);
      await cli(context, ['host', 'register', context.hostId, '--name', context.name, '--harness', context.harness, '--capability', 'independent_session', '--capability', context === browser ? 'browser' : 'shell']);
    }
    equal(new Set(contexts.map(context => context.workspace)).size, 3, 'three separate host-local workspace paths');
    equal(new Set(contexts.map(context => context.home)).size, 3, 'three independent CLI homes');
    const project = await cli(owner, ['project', 'create', '--name', 'Local-only acceptance project', '--canonical-path', owner.workspace, '--github-owner', 'simulation', '--github-repo', 'local-only']);
    projectId = project.id;
    for (const context of contexts) {
      await cli(owner, ['host', 'grant', context.hostId, '--project-id', projectId, '--workspace-ref', 'acceptance-project']);
      await cli(context, ['host', 'workspace', context.hostId, '--project-id', projectId, '--available', '--working-path', context.workspace]);
    }
    const agent = await cli(owner, ['agent', 'create', '--slug', 'deterministic-worker', '--name', 'Deterministic worker', '--instructions', 'Pinned simulator instructions version one.']);
    check(agent.id, 'agent authored through public CLI');
    return { contexts: contexts.map(({ id, hostId, harness, workspace }) => ({ id, hostId, harness, workspace })), sharedDatabase: 'one local libSQL file', networkServices: [], apiKeysRequired: false };
  });

  const single = await graph('simulation-single', [node('work')], [{ source: 'start', target: 'work' }, { source: 'work', target: 'end' }]);

  await scenario('capability-and-workspace-preflight', async () => {
    const goalId = await goal(single, 'Explain ineligible hosts');
    const reservation = await dispatch(goalId);
    const browserPreflight = await cli(browser, ['attempt', 'preflight', reservation.attemptId, '--owner-id', browser.hostId]);
    equal(browserPreflight.eligible, false, 'browser-only host cannot perform shell work');
    check(browserPreflight.missingCapabilities.includes('shell'), 'missing capability is explained');
    await rejected(browser, ['attempt', 'claim', reservation.attemptId, '--owner-id', browser.hostId], 'PREFLIGHT_FAILED');
    await cli(server, ['host', 'workspace', server.hostId, '--project-id', projectId, '--unavailable']);
    const unavailable = await cli(server, ['attempt', 'preflight', reservation.attemptId, '--owner-id', server.hostId]);
    equal(unavailable.eligible, false, 'unavailable local workspace prevents execution');
    await rejected(server, ['attempt', 'claim', reservation.attemptId, '--owner-id', server.hostId], 'PREFLIGHT_FAILED');
    await cli(server, ['host', 'workspace', server.hostId, '--project-id', projectId, '--available', '--working-path', server.workspace]);
    await cli(browser, ['host', 'register', 'host-no-isolation', '--name', 'Cannot launch independent workers', '--capability', 'shell']);
    await rejected(browser, ['attempt', 'preflight', reservation.attemptId, '--owner-id', 'host-no-isolation'], 'WORKSPACE_NOT_GRANTED');
    await cli(owner, ['host', 'grant', 'host-no-isolation', '--project-id', projectId, '--workspace-ref', 'acceptance-project']);
    await cli(browser, ['host', 'workspace', 'host-no-isolation', '--project-id', projectId, '--available', '--working-path', browser.workspace]);
    const noSession = await cli(browser, ['attempt', 'preflight', reservation.attemptId, '--owner-id', 'host-no-isolation']);
    equal(noSession.eligible, false, 'independent worker capability is mandatory');
    check(noSession.missingCapabilities.includes('independent_session'), 'missing session capability is explained');
    const discovered = await cli(server, ['host', 'discover', server.hostId]);
    check(discovered.some((item: Json) => item.attemptId === reservation.attemptId && item.preflight.eligible), 'eligible granted cross-context host discovers assignment');
    const ownership = await claim(reservation, server);
    const session = await worker(reservation, ownership, server);
    await session.request('finish', 'finished');
    await completed(goalId);
    return { missingCapability: 'shell', missingSessionCapability: 'independent_session', executingHost: server.hostId };
  });

  await scenario('process-contention-replay-and-start-contract', async () => {
    const goalId = await goal(single, 'Race independent CLI processes');
    const [item] = await ready(goalId);
    const commands = [dispatchArguments(goalId, item!, 'race-a'), dispatchArguments(goalId, item!, 'race-b')];
    const raced = await Promise.all(commands.map(command => raw(owner, command)));
    const winners = raced.map((response, index) => ({ ...response, index })).filter(response => response.exitCode === 0);
    equal(winners.length, 1, 'competing CLI processes reserve at most one activation');
    const winner = winners[0]!;
    const reservation = winner.value;
    equal((await cli(owner, ['run', 'state', goalId])).attempts.length, 1, 'contention creates only one attempt');
    const replay = await cli(owner, commands[winner.index]!);
    equal(replay.attemptId, reservation.attemptId, 'dispatch request replay preserves attempt identity');
    await rejected(owner, [...commands[winner.index]!, '--working-path', '/conflicting-input'], 'IDEMPOTENCY_CONFLICT');
    const claims = await Promise.all([raw(owner, ['attempt', 'claim', reservation.attemptId, '--owner-id', owner.hostId]), raw(server, ['attempt', 'claim', reservation.attemptId, '--owner-id', server.hostId])]);
    equal(claims.filter(response => response.exitCode === 0).length, 1, 'only one competing owner receives a claim');
    const winningIndex = claims.findIndex(response => response.exitCode === 0);
    const context = winningIndex === 0 ? owner : server;
    const ownership = claims[winningIndex]!.value;
    await rejected(context, ['attempt', 'start', reservation.attemptId, '--token', ownership.token, '--external-session-id', 'same-session', '--parent-session-id', 'same-session', '--working-path', context.workspace], 'INDEPENDENT_SESSION_REQUIRED');
    await rejected(context, ['attempt', 'start', reservation.attemptId, '--token', ownership.token, '--external-session-id', 'different-session', '--parent-session-id', 'parent-session', '--working-path', browser.workspace], 'PREFLIGHT_FAILED');
    const session = await worker(reservation, ownership, context, { outcome: 'accepted', value: 42 });
    await session.request('finish', 'finished');
    await completed(goalId);
    const replayResult = await cli(context, ['attempt', 'update', reservation.attemptId, '--token', ownership.token, '--status', 'succeeded', '--result-json', '{"outcome":"accepted","value":42}']);
    equal(replayResult.status, 'succeeded', 'identical terminal report is idempotent');
    await rejected(context, ['attempt', 'update', reservation.attemptId, '--token', ownership.token, '--status', 'succeeded', '--result-json', '{"outcome":"accepted","value":43}'], 'RESULT_CONFLICT');
    return { reservationWinners: winners.length, claimWinners: 1, workerPid: session.process.pid, controllerPid: process.pid };
  });

  await scenario('conditional-backedge-and-bounded-cycles', async () => {
    const cycle = await graph('simulation-cycle', [node('draft'), node('review')], [
      { source: 'start', target: 'draft' }, { source: 'draft', target: 'review' },
      { source: 'review', target: 'draft', condition: { outcome: 'needs_revision' } },
      { source: 'review', target: 'end', condition: { outcome: 'accepted' } },
    ], 8);
    const goalId = await goal(cycle, 'Revise once through a backedge');
    const visits: string[] = [];
    for (const outcome of ['drafted', 'needs_revision', 'drafted', 'accepted']) {
      const execution = await execute(goalId, owner, { outcome });
      visits.push(execution.reservation.activationId);
    }
    equal(new Set(visits).size, 4, 'backedge creates a fresh activation rather than replaying the earlier visit');
    await completed(goalId);
    const bounded = await graph('simulation-bounded', [node('repeat')], [
      { source: 'start', target: 'repeat' },
      { source: 'repeat', target: 'repeat', condition: { outcome: 'again' } },
      { source: 'repeat', target: 'end', condition: { outcome: 'accepted' } },
    ], 2);
    const boundedGoal = await goal(bounded, 'Stop a cycle at its explicit budget');
    await execute(boundedGoal, owner, { outcome: 'again' });
    await execute(boundedGoal, owner, { outcome: 'again' });
    equal((await ready(boundedGoal)).length, 0, 'budget exhaustion does not dispatch another visit');
    const explanation = await state(boundedGoal);
    check(JSON.stringify(explanation).includes('activation_limit_reached'), 'explanation names the visit budget blocker');
    await cli(owner, ['goal', 'activation-budget', boundedGoal, '--max-activations', '3']);
    await execute(boundedGoal, owner, { outcome: 'accepted' });
    await completed(boundedGoal);
    return { backedgeVisits: visits.length, boundedVisitsBeforeExplicitIncrease: 2 };
  });

  await scenario('multi-context-fanout-and-explicit-join', async () => {
    const fork = await graph('simulation-fanout', [node('fork'), node('shell-branch'), node('browser-branch', { requirements: ['browser'] }), node('join', { joinForkNodeId: 'fork' })], [
      { source: 'start', target: 'fork' }, { source: 'fork', target: 'shell-branch' }, { source: 'fork', target: 'browser-branch' },
      { source: 'shell-branch', target: 'join' }, { source: 'browser-branch', target: 'join' }, { source: 'join', target: 'end' },
    ]);
    const goalId = await goal(fork, 'Run independent branches and join explicitly');
    await execute(goalId);
    equal((await ready(goalId)).length, 2, 'all matching fanout edges produce ready activations');
    const first = await dispatch(goalId);
    const second = await dispatch(goalId);
    const active: Array<{ session: WorkerSession; context: HostContext; reservation: Json }> = [];
    for (const reservation of [first, second]) {
      const candidate = await cli(browser, ['attempt', 'preflight', reservation.attemptId, '--owner-id', browser.hostId]);
      const context = candidate.eligible ? browser : server;
      const ownership = await claim(reservation, context);
      active.push({ session: await worker(reservation, ownership, context, { outcome: 'accepted', branchHost: context.hostId }), context, reservation });
    }
    check(active[0]!.session.process.pid !== active[1]!.session.process.pid, 'fanout uses two concurrently live worker processes');
    check(active[0]!.context.workspace !== active[1]!.context.workspace, 'fanout does not presume shared checkout paths');
    await active[0]!.session.request('finish', 'finished');
    check((await state(goalId)).state !== 'completed', 'one finished branch cannot complete goal');
    equal((await ready(goalId)).length, 0, 'explicit join waits for the outstanding branch');
    await active[1]!.session.request('finish', 'finished');
    equal((await ready(goalId)).length, 1, 'explicit join produces one activation');
    const joined = await execute(goalId);
    const packet = joined.ownership.packet;
    check(JSON.stringify(packet).includes(browser.hostId) && JSON.stringify(packet).includes(server.hostId), 'join packet carries both branch results through coordination state');
    await completed(goalId);
    return { branchPids: active.map(item => item.session.process.pid), branchHosts: active.map(item => item.context.hostId), joinActivations: 1 };
  });

  await scenario('conditional-rejection-and-unselected-join-paths', async () => {
    const selected = await graph('simulation-selected-paths', [node('choose'), node('selected'), node('unselected'), node('join', { joinForkNodeId: 'choose' })], [
      { source: 'start', target: 'choose' },
      { source: 'choose', target: 'selected', condition: { outcome: 'left' } },
      { source: 'choose', target: 'unselected', condition: { outcome: 'right' } },
      { source: 'selected', target: 'join' }, { source: 'unselected', target: 'join' }, { source: 'join', target: 'end' },
    ]);
    const goalId = await goal(selected, 'Reject unmatched outcomes and wait only selected descendants');
    const reservation = await dispatch(goalId);
    const ownership = await claim(reservation);
    const session = await worker(reservation, ownership, owner, { outcome: 'left' });
    await rejected(owner, ['attempt', 'update', reservation.attemptId, '--token', ownership.token, '--status', 'succeeded', '--result-json', '{"outcome":"unsupported"}'], 'NO_MATCHING_EDGE');
    equal((await cli(owner, ['attempt', 'show', reservation.attemptId])).status, 'running', 'unmatched outcome cannot commit a terminal success');
    await session.request('finish', 'finished');
    equal((await ready(goalId)).length, 1, 'only the selected conditional edge activates');
    await execute(goalId);
    equal((await ready(goalId)).length, 1, 'join does not wait for an unselected branch');
    const join = await execute(goalId);
    equal(join.ownership.packet.objective, 'Complete join', 'selected path enables its paired join');
    await completed(goalId);
    return { unmatchedCompletionRejected: true, selectedBranches: 1, unselectedBranchesAwaited: 0 };
  });

  await scenario('join-retry-and-completion-replay', async () => {
    const definition = await graph('simulation-join-retry', [node('fork'), node('left'), node('right'), node('join', { joinForkNodeId: 'fork' })], [
      { source: 'start', target: 'fork' }, { source: 'fork', target: 'left' }, { source: 'fork', target: 'right' },
      { source: 'left', target: 'join' }, { source: 'right', target: 'join' }, { source: 'join', target: 'end' },
    ]);
    const goalId = await goal(definition, 'Preserve join lineage through a failed attempt and retry');
    await execute(goalId);
    const first = await dispatch(goalId);
    const second = await dispatch(goalId);
    const firstOwner = await claim(first);
    const secondOwner = await claim(second, server);
    const firstWorker = await worker(first, firstOwner);
    const secondWorker = await worker(second, secondOwner, server, { outcome: 'accepted', branch: 'surviving' });
    await firstWorker.request('fail', 'failed');
    await secondWorker.request('finish', 'finished');
    const plans = await ready(goalId);
    equal(plans.length, 1, 'failed branch is retryable while join remains waiting');
    equal(plans[0]!.activationId, first.activationId, 'retry stays on the failed branch activation');
    const retry = await execute(goalId);
    equal(retry.reservation.activationId, first.activationId, 'retry preserves fork lineage');
    check(retry.reservation.attemptId !== first.attemptId, 'retry creates a distinct attempt');
    equal((await ready(goalId)).length, 1, 'settled retry enables one join');
    await cli(server, ['attempt', 'update', second.attemptId, '--token', secondOwner.token, '--status', 'succeeded', '--result-json', '{"outcome":"accepted","branch":"surviving"}']);
    equal((await ready(goalId)).length, 1, 'terminal replay cannot create another join');
    const joined = await execute(goalId);
    equal(joined.ownership.packet.objective, 'Complete join', 'single join executes after retry');
    await completed(goalId);
    return { failedAttempt: first.attemptId, retryAttempt: retry.reservation.attemptId, joinActivations: 1 };
  });

  await scenario('nested-forks-convergence-and-join-generations', async () => {
    async function drain(goalId: string, resultFor: (objective: string, count: number) => Json = () => ({ outcome: 'accepted' })) {
      const counts: Record<string, number> = {};
      while ((await state(goalId)).state !== 'completed') {
        check(Object.values(counts).reduce((sum, count) => sum + count, 0) < 30, 'bounded deterministic drain must finish');
        const reservation = await dispatch(goalId);
        const ownership = await claim(reservation);
        const objective = ownership.packet.objective as string;
        counts[objective] = (counts[objective] ?? 0) + 1;
        const session = await worker(reservation, ownership, owner, resultFor(objective, counts[objective]!));
        await session.request('finish', 'finished');
      }
      await completed(goalId);
      return counts;
    }
    const nested = await graph('simulation-nested', [node('outer'), node('inner'), node('outer-other'), node('inner-a'), node('inner-b'), node('inner-join', { joinForkNodeId: 'inner' }), node('outer-join', { joinForkNodeId: 'outer' })], [
      { source: 'start', target: 'outer' }, { source: 'outer', target: 'inner' }, { source: 'outer', target: 'outer-other' },
      { source: 'inner', target: 'inner-a' }, { source: 'inner', target: 'inner-b' },
      { source: 'inner-a', target: 'inner-join' }, { source: 'inner-b', target: 'inner-join' },
      { source: 'inner-join', target: 'outer-join' }, { source: 'outer-other', target: 'outer-join' }, { source: 'outer-join', target: 'end' },
    ]);
    const nestedCounts = await drain(await goal(nested, 'Pair nested forks with independent joins'));
    equal(nestedCounts['Complete inner-join'], 1, 'inner fork joins exactly once');
    equal(nestedCounts['Complete outer-join'], 1, 'outer fork joins exactly once');
    const split = await graph('simulation-descendant-split', [node('outer'), node('splitter'), node('exit-branch'), node('leaf-a'), node('leaf-b'), node('aggregate', { joinForkNodeId: 'outer' })], [
      { source: 'start', target: 'outer' }, { source: 'outer', target: 'splitter' }, { source: 'outer', target: 'exit-branch' },
      { source: 'splitter', target: 'leaf-a' }, { source: 'splitter', target: 'leaf-b' },
      { source: 'leaf-a', target: 'aggregate' }, { source: 'leaf-b', target: 'aggregate' },
      { source: 'exit-branch', target: 'end' }, { source: 'aggregate', target: 'end' },
    ]);
    const splitCounts = await drain(await goal(split, 'Wait for splitting descendants and successful exits'));
    equal(splitCounts['Complete aggregate'], 1, 'descendant split and successful exit settle one join');
    const convergent = await graph('simulation-convergence', [node('fork'), node('a'), node('b'), node('merge')], [
      { source: 'start', target: 'fork' }, { source: 'fork', target: 'a' }, { source: 'fork', target: 'b' },
      { source: 'a', target: 'merge' }, { source: 'b', target: 'merge' }, { source: 'merge', target: 'end' },
    ]);
    const convergenceCounts = await drain(await goal(convergent, 'Execute ordinary convergence per arrival'));
    equal(convergenceCounts['Complete merge'], 2, 'ordinary convergence is not an implicit join');
    const repeated = await graph('simulation-join-cycle', [node('fork'), node('left'), node('right'), node('join', { joinForkNodeId: 'fork' })], [
      { source: 'start', target: 'fork' }, { source: 'fork', target: 'left' }, { source: 'fork', target: 'right' },
      { source: 'left', target: 'join' }, { source: 'right', target: 'join' },
      { source: 'join', target: 'fork', condition: { outcome: 'again' } }, { source: 'join', target: 'end', condition: { outcome: 'accepted' } },
    ]);
    const cycleCounts = await drain(await goal(repeated, 'Keep join generations distinct across backedges'), (objective, count) => ({ outcome: objective === 'Complete join' && count === 1 ? 'again' : 'accepted' }));
    equal(cycleCounts['Complete join'], 2, 'cycle creates one join for each distinct fork generation');
    equal(cycleCounts['Complete fork'], 2, 'cycle reenters the fork as a new activation');
    const exits = await graph('simulation-zero-arrivals', [node('fork'), node('a'), node('b'), node('join', { joinForkNodeId: 'fork' })], [
      { source: 'start', target: 'fork' }, { source: 'fork', target: 'a' }, { source: 'fork', target: 'b' },
      { source: 'a', target: 'join', condition: { outcome: 'arrive' } }, { source: 'a', target: 'end', condition: { outcome: 'accepted' } },
      { source: 'b', target: 'join', condition: { outcome: 'arrive' } }, { source: 'b', target: 'end', condition: { outcome: 'accepted' } },
      { source: 'join', target: 'end' },
    ]);
    const exitCounts = await drain(await goal(exits, 'Do not invent a join with zero arrivals'));
    equal(exitCounts['Complete join'] ?? 0, 0, 'successful exits with no arrivals never create a join');
    return { nestedCounts, splitCounts, convergenceCounts, cycleCounts, exitCounts };
  });

  await scenario('completion-evidence-and-publication-pinning', async () => {
    const gated = await graph('simulation-evidence', [node('validate', { completion: { requireReview: true, evidenceKinds: ['test'] } })], [{ source: 'start', target: 'validate' }, { source: 'validate', target: 'end' }]);
    const goalId = await goal(gated, 'Honor configured gates');
    const execution = await execute(goalId, server);
    equal(execution.finished.status, 'paused', 'reported success waits for configured evidence and review');
    await cli(server, ['attempt', 'evidence', execution.reservation.attemptId, '--token', execution.ownership.token, '--kind', 'test', '--label', 'Deterministic local worker acceptance assertions']);
    check((await state(goalId)).state !== 'completed', 'evidence alone does not bypass required review');
    await cli(owner, ['attempt', 'review', execution.reservation.attemptId, '--status', 'approved', '--reviewer', 'deterministic-test-operator']);
    await completed(goalId);
    const oldGoal = await goal(single, 'Pin original agent instructions');
    await cli(owner, ['agent', 'update', 'deterministic-worker', '--instructions', 'Pinned simulator instructions version two.']);
    await cli(owner, ['sendero', 'draft', 'simulation-single']);
    const newer = await cli(owner, ['sendero', 'publish', 'simulation-single']);
    const oldExecution = await execute(oldGoal);
    equal(oldExecution.ownership.packet.agent.instructions, 'Pinned simulator instructions version one.', 'existing publication retains original instructions');
    equal(oldExecution.ownership.packet.senderoVersionId, single.version.id, 'existing goal retains original version');
    const newGoal = await goal(newer, 'Use newly published instructions');
    const newExecution = await execute(newGoal);
    equal(newExecution.ownership.packet.agent.instructions, 'Pinned simulator instructions version two.', 'new publication snapshots new instructions');
    await completed(oldGoal);
    await completed(newGoal);
    return { originalVersion: single.version.id, newVersion: newer.version.id, gates: ['test', 'review'] };
  });

  await scenario('crash-orphan-unknown-finished-and-fencing-recovery', async () => {
    const cases: Array<{ kind: string; goalId: string; reservation: Json; ownership: Json; session: WorkerSession }> = [];
    for (const kind of ['active', 'missing', 'finished', 'unknown', 'unrecorded']) {
      const goalId = await goal(single, `Reconcile ${kind} process state`);
      const reservation = await dispatch(goalId);
      const ownership = await claim(reservation, server, 10);
      const session = await worker(reservation, ownership, server, { outcome: 'accepted', recovered: kind }, kind === 'unrecorded');
      cases.push({ kind, goalId, reservation, ownership, session });
      if (kind === 'missing') await session.kill();
      if (kind === 'finished') {
        await session.request('finish-without-report', 'finished-unreported');
        await session.process.exited;
      }
    }
    await expired(cases.map(item => item.ownership));
    for (const item of cases) {
      check(JSON.stringify(await state(item.goalId)).includes('lease_expired'), 'expired lease blocks normal progress');
      await rejected(server, ['attempt', 'claim', item.reservation.attemptId, '--owner-id', server.hostId, '--reclaim'], 'RECOVERY_REQUIRED');
      if (item.kind === 'active') {
        const resumed = await cli(server, ['attempt', 'resume', item.reservation.attemptId]);
        check(JSON.stringify(resumed).includes(`worker-${item.reservation.attemptId}`), 'resume returns recorded independent session');
        await cli(server, ['attempt', 'reconcile', item.reservation.attemptId, '--owner-id', server.hostId, '--outcome', 'active', '--external-session-id', `worker-${item.reservation.attemptId}`, '--details', 'Controller retained the live worker PID and verified the session is still active.']);
        const reclaimed = await cli(server, ['attempt', 'claim', item.reservation.attemptId, '--owner-id', server.hostId, '--reclaim']);
        check(reclaimed.token !== item.ownership.token, 'reclaim rotates fence');
        await rejected(server, ['attempt', 'heartbeat', item.reservation.attemptId, '--token', item.ownership.token], 'NOT_FOUND');
        await rejected(owner, ['attempt', 'heartbeat', item.reservation.attemptId, '--token', item.ownership.token], 'STALE_OWNER');
        await item.session.request('replace-token', 'token-replaced', { token: reclaimed.token });
        await item.session.request('finish', 'finished');
        await completed(item.goalId);
      } else if (item.kind === 'finished') {
        await cli(server, ['attempt', 'reconcile', item.reservation.attemptId, '--owner-id', server.hostId, '--outcome', 'finished', '--external-session-id', `worker-${item.reservation.attemptId}`, '--details', 'Worker exited successfully after returning its result over stdout, before reporting to Senderos.', '--status', 'succeeded', '--result-json', JSON.stringify({ outcome: 'accepted', recovered: 'finished' })]);
        await completed(item.goalId);
        await rejected(server, ['attempt', 'update', item.reservation.attemptId, '--token', item.ownership.token, '--status', 'succeeded', '--result-json', '{"outcome":"accepted"}'], 'NOT_FOUND');
        await rejected(owner, ['attempt', 'update', item.reservation.attemptId, '--token', item.ownership.token, '--status', 'succeeded', '--result-json', '{"outcome":"accepted"}'], 'STALE_OWNER');
      } else {
        if (item.kind === 'unrecorded') {
          await rejected(server, ['attempt', 'reconcile', item.reservation.attemptId, '--owner-id', server.hostId, '--outcome', 'active', '--external-session-id', `worker-${item.reservation.attemptId}`, '--details', 'The real worker launched, but startup reporting was interrupted before any session was recorded.'], 'SESSION_CONFLICT');
          await item.session.kill();
        }
        await cli(server, ['attempt', 'reconcile', item.reservation.attemptId, '--owner-id', server.hostId, '--outcome', item.kind === 'unrecorded' ? 'missing' : item.kind, '--details', item.kind === 'missing' || item.kind === 'unrecorded' ? 'Controller sent SIGKILL and awaited the known worker process exit.' : 'Simulated inspection outage; process status cannot be established.']);
        if (item.kind === 'unknown') {
          await rejected(server, ['attempt', 'claim', item.reservation.attemptId, '--owner-id', server.hostId, '--reclaim'], 'RECOVERY_REQUIRED');
          equal((await ready(item.goalId)).length, 0, 'unknown external process state remains blocked');
          await item.session.kill();
          await cli(server, ['attempt', 'reconcile', item.reservation.attemptId, '--owner-id', server.hostId, '--outcome', 'missing', '--details', 'Inspection restored; controller stopped and awaited the recorded worker process.']);
        }
        await rejected(server, ['attempt', 'abandon', item.reservation.attemptId, '--token', item.ownership.token, '--reason', 'No explicit stop confirmation'], 'STOP_CONFIRMATION_REQUIRED');
        await cli(server, ['attempt', 'abandon', item.reservation.attemptId, '--token', item.ownership.token, '--confirmed-stopped', '--reason', 'Controller verified recorded worker has exited.']);
        const retried = await execute(item.goalId, owner);
        check(retried.reservation.attemptId !== item.reservation.attemptId, 'recovery retry has a new attempt');
        equal(retried.reservation.activationId, item.reservation.activationId, 'retry retains original activation identity');
        await completed(item.goalId);
      }
    }
    return { realProcessKill: true, observedOutcomes: ['active', 'missing', 'finished', 'unknown'], unrecordedLaunchBlockedUntilStopped: true, leasesExpiredWithoutClockMutation: true };
  });

  await scenario('grant-revocation-drains-owned-worker', async () => {
    const goalId = await goal(single, 'Drain an existing worker after its grant is revoked');
    const reservation = await dispatch(goalId);
    const ownership = await claim(reservation, server);
    const session = await worker(reservation, ownership, server);
    await cli(owner, ['host', 'grant', server.hostId, '--project-id', projectId, '--workspace-ref', 'acceptance-project', '--revoke']);
    await rejected(server, ['attempt', 'preflight', reservation.attemptId, '--owner-id', server.hostId], 'WORKSPACE_NOT_GRANTED');
    const retained = (await cli(server, ['host', 'discover', server.hostId])).find((item: Json) => item.attemptId === reservation.attemptId);
    check(retained && !retained.preflight.eligible && retained.preflight.blockers.includes('workspace_not_granted'), 'revoked host can still discover its existing worker for safe draining');
    const heartbeat = await session.request('heartbeat', 'heartbeat');
    check(heartbeat.heartbeat, 'existing owner can heartbeat to drain safely');
    await session.request('finish', 'finished');
    await completed(goalId);
    await cli(owner, ['host', 'grant', server.hostId, '--project-id', projectId, '--workspace-ref', 'acceptance-project']);
    await cli(server, ['host', 'workspace', server.hostId, '--project-id', projectId, '--available', '--working-path', server.workspace]);
    return { newExecutionBlocked: true, existingWorkerFinishedWithoutLosingOwnership: true };
  });

  await scenario('worker-cancellation-acknowledgement', async () => {
    const definition = await graph('simulation-cancel-fanout', [node('fork'), node('a'), node('b')], [
      { source: 'start', target: 'fork' }, { source: 'fork', target: 'a' }, { source: 'fork', target: 'b' },
      { source: 'a', target: 'end' }, { source: 'b', target: 'end' },
    ]);
    const goalId = await goal(definition, 'Cancel all owned branches cooperatively');
    await execute(goalId);
    const first = await dispatch(goalId);
    const second = await dispatch(goalId);
    const firstWorker = await worker(first, await claim(first));
    const secondWorker = await worker(second, await claim(second, server), server);
    await cli(owner, ['goal', 'cancel', goalId]);
    check((await state(goalId)).state !== 'canceled', 'owned workers require cancellation acknowledgement');
    const stopped = await firstWorker.request('cancel', 'canceled');
    equal(stopped.status, 'canceled', 'first worker observes and acknowledges cancellation');
    check((await state(goalId)).state !== 'canceled', 'one acknowledgement cannot hide another live branch');
    const secondStopped = await secondWorker.request('cancel', 'canceled');
    equal(secondStopped.status, 'canceled', 'second worker observes and acknowledges cancellation');
    await Promise.all([firstWorker.process.exited, secondWorker.process.exited]);
    equal((await state(goalId)).state, 'canceled', 'all acknowledged branches make cancellation terminal');
    return { workerPids: [firstWorker.process.pid, secondWorker.process.pid], acknowledgedThroughHeartbeat: true };
  });

  const report = { schemaVersion: 1, success: true, controllerPid: process.pid, workerProcesses: sessions.length, controllerCliProcesses: cliProcesses, cliProcesses: cliProcesses + sessions.reduce((sum, session) => sum + session.cliProcesses, 0), assertionCount, elapsedMs: Date.now() - startedAt, scenarios, boundaries: { realCliProcesses: true, independentWorkerProcesses: true, physicalMachines: 1, sharedCoordinationDatabase: 'local libSQL', sharedWorkerFilesRequired: false, modelCalls: 0, apiKeysRequired: false }, ...(keep ? { runtime } : {}) };
  if (reportPath) { mkdirSync(dirname(reportPath), { recursive: true }); writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`); }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} catch (error) {
  const report = { schemaVersion: 1, success: false, scenario: currentScenario, message: (error as Error).message, completedScenarios: scenarios, assertionCount, cliProcesses, elapsedMs: Date.now() - startedAt, ...(keep ? { runtime } : {}) };
  if (reportPath) { mkdirSync(dirname(reportPath), { recursive: true }); writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`); }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = 1;
} finally {
  for (const session of sessions) {
    if (session.process.exitCode === null) await session.kill();
  }
  if (!keep) rmSync(runtime, { recursive: true, force: true });
}
