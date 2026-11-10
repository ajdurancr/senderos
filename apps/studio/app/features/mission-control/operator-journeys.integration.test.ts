import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient, type Client } from '@libsql/client';
import type { SenderoGraph } from '@senderos/core';
import { reviewDispatch } from './dispatch-review';

// Use a unique real database, never the manual QA preview or mocked persistence.
const root = resolve(process.env.SENDEROS_TEST_RUNTIME_ROOT ?? resolve(import.meta.dirname, '../../../../../.tmp/test-runtime'), `studio-journeys-${crypto.randomUUID()}`);
mkdirSync(root, { recursive: true });
const databaseUrl = `file:${resolve(root, 'operator-journeys.db')}`;
process.env.SENDEROS_DATABASE_URL = databaseUrl;

const form = (values: Record<string, string>) => {
  const body = new FormData();
  for (const [key, value] of Object.entries(values)) body.set(key, value);
  return body;
};
const reviewedGraph = (graph: SenderoGraph) => ({ senderoId: graph.sendero.id, expectedVersionId: graph.version.id, expectedRevision: graph.revision! });

describe('persisted Studio operator journeys after manual acceptance', () => {
  let server: typeof import('./server');
  let core: typeof import('@senderos/core');
  let db: Client;
  beforeAll(async () => {
    server = await import('./server');
    core = await import('@senderos/core');
    await server.missionControlData();
    db = createClient({ url: databaseUrl });
  });
  afterAll(() => {
    db?.close();
    rmSync(root, { recursive: true, force: true });
  });

  const submit = (values: Record<string, string>) => server.applyMissionControlAction(form(values));
  async function persistedSnapshot() {
    const tables = (await db.execute("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")).rows;
    return Promise.all(tables.map(async row => ({ table: row.name, rows: (await db.execute(`SELECT * FROM "${row.name}" ORDER BY 1`)).rows })));
  }
  async function projectFixture() {
    const id = crypto.randomUUID();
    await core.registerExecutionContext({ id: `context-${id}`, name: `Context ${id}` });
    const api = core.createSenderos({ executionContextId: `context-${id}` });
    const project = await api.commands.projects.create({ name: `Project ${id}`, canonicalPath: '/test/studio-journeys', githubOwner: 'example', githubRepo: 'launch', targetBranch: 'main', integrationMode: 'github_pr' });
    return { api, project };
  }
  async function createAgent(label: string) {
    const slug = `journey-${crypto.randomUUID()}`;
    await submit({ intent: 'create-agent', slug, name: label, description: `${label} description`, instructions: `${label} original instructions`, status: 'active' });
    return (await server.missionControlData()).agents.find(agent => agent.slug === slug)!;
  }
  async function importGraph(agentId: string, parallel = false, gate = false) {
    const slug = `journey-${crypto.randomUUID()}`;
    const steps = parallel ? ['Accessibility', 'Content', 'Join'] : ['Review'];
    await submit({ intent: 'import-sendero', definition: JSON.stringify({
      slug, name: 'Operator journey', nodes: [
        { key: 'start', kind: 'start', label: 'Begin' },
        ...steps.map(key => ({ key, kind: 'agent', label: key, agentId, executionObjective: `Perform ${key}`, completion: gate ? { requireReview: true, evidenceKinds: ['test'] } : {}, requirements: ['independent_session', 'browser'], ...(key === 'Join' ? { joinForkNodeId: 'start' } : {}) })),
        { key: 'end', kind: 'end', label: 'Done' },
      ], edges: (parallel ? [['start', 'Accessibility'], ['start', 'Content'], ['Accessibility', 'Join'], ['Content', 'Join'], ['Join', 'end']] : [['start', 'Review'], ['Review', 'end']]).map(([source, target]) => ({ source, target, name: `${source} to ${target}` })),
    }) });
    const draft = (await server.missionControlData()).draftGraphs.find(graph => graph.sendero.slug === slug)!;
    await submit({ intent: 'publish-sendero', ...reviewedGraph(draft) });
    return (await core.getSenderoGraph(draft.sendero.id, draft.version.version))!;
  }
  async function createGoal(projectId: string, graph: SenderoGraph, title = `Goal ${crypto.randomUUID()}`) {
    await submit({ intent: 'create-goal', projectId, title, kind: 'feature', specText: 'Keyboard and responsive acceptance must pass.', senderoVersionId: graph.version.id });
    return (await server.missionControlData()).goals.find(goal => goal.title === title)!;
  }
  async function reserve(projectId: string, goalId: string, count = 1) {
    const before = await server.missionControlData();
    const reviewed = before.queue.dispatchable.filter(item => item.goalId === goalId).map(reviewDispatch);
    expect(reviewed).toHaveLength(count);
    await server.applyMissionControlAction(form({ intent: 'dispatch-plan', scope: JSON.stringify({ projectId }), reviewedItems: JSON.stringify(reviewed) }), { projectId });
    const after = await server.missionControlData();
    const runs = after.runs.filter(run => run.goalId === goalId && !before.runs.some(previous => previous.id === run.id));
    expect(runs).toHaveLength(count);
    const reservations = runs.map(run => ({ run, attempt: after.attempts.find(attempt => attempt.runId === run.id)! }));
    for (const { run, attempt } of reservations) {
      expect(run).toMatchObject({ status: 'queued', activationId: expect.any(String) });
      const selected = reviewed.find(item => item.activationId === run.activationId)!;
      expect(after.activations.find(item => item.id === selected.activationId)).toMatchObject({
        latestRunId: run.id, revision: selected.revision + 1, status: 'running',
      });
      expect(attempt).toMatchObject({ status: 'queued', checkpoint: 'awaiting_host', ownerId: null, externalSessionId: null, startedAt: null, finishedAt: null });
      expect((await db.execute({ sql: 'SELECT protocol_version, owner_id, token, parent_session_id FROM attempt_claims WHERE attempt_id = ?', args: [attempt.id] })).rows[0]).toMatchObject({ protocol_version: 2, owner_id: null, token: null, parent_session_id: null });
    }
    return { reviewed, reservations };
  }
  async function host(projectId: string, attemptId: string) {
    const api = core.createSenderos({ executionContextId: (await core.getProject(projectId))!.executionContextId });
    const ownerId = `host-${crypto.randomUUID()}`;
    const workingPath = `/test/workspaces/${attemptId}`;
    // Only the external process is a deterministic boundary. Registry, grants,
    // preflight, claim, independent-session start and updates are real commands.
    await api.commands.hosts.register({ id: ownerId, name: 'Deterministic external host', harness: 'integration-test', capabilities: ['independent_session', 'browser'] });
    await api.commands.hosts.grant({ hostId: ownerId, projectId, workspaceRef: `project:${projectId}` });
    await api.commands.hosts.workspace({ hostId: ownerId, projectId, available: true, workingPath });
    expect(await api.commands.hosts.preflight({ attemptId, ownerId })).toMatchObject({ eligible: true, missingCapabilities: [] });
    const claim = await api.commands.attempts.claim({ attemptId, ownerId });
    expect(await api.commands.attempts.get(attemptId)).toMatchObject({ status: 'queued', checkpoint: 'claimed', ownerId, externalSessionId: null, startedAt: null });
    const externalSessionId = `external-worker:${attemptId}`;
    await api.commands.attempts.start({ attemptId, token: claim.token, externalSessionId, parentSessionId: `controller:${ownerId}`, workingPath });
    expect(await api.commands.attempts.get(attemptId)).toMatchObject({ status: 'running', checkpoint: 'started', ownerId, externalSessionId, startedAt: expect.any(String) });
    return { api, claim, externalSessionId, ownerId };
  }

  it('authors and pins a graph, starts without runs, retries the same activation and settles only genuine host completion gates', async () => {
    const { project } = await projectFixture();
    const builder = await createAgent('Builder');
    const reviewer = await createAgent('Accessibility reviewer');
    const slug = `launch-${crypto.randomUUID()}`;
    await submit({ intent: 'create-sendero', name: 'Accessible launch', slug });
    let graph = (await server.missionControlData()).draftGraphs.find(graph => graph.sendero.slug === slug)!;
    const definition = { maxActivations: 10, nodes: [
      { key: 'start', kind: 'start', label: 'Begin launch' },
      { key: 'builder', kind: 'agent', label: 'Builder', agentId: builder.id, executionObjective: 'Implement the accessible launch page.', completion: {}, requirements: ['independent_session', 'browser'] },
      { key: 'reviewer', kind: 'agent', label: 'Accessibility review', agentId: reviewer.id, executionObjective: 'Verify keyboard and responsive acceptance.', completion: { requireReview: true, evidenceKinds: ['test'] }, requirements: ['independent_session', 'browser'] },
      { key: 'end', kind: 'end', label: 'Accepted' },
    ], edges: [
      { key: 'begin', source: 'start', target: 'builder', name: 'Build' },
      { key: 'review', source: 'builder', target: 'reviewer', name: 'Independent review' },
      { key: 'finish', source: 'reviewer', target: 'end', name: 'Accepted outcome', condition: { outcome: 'accepted' } },
    ] };
    await submit({ intent: 'replace-sendero-draft', ...reviewedGraph(graph), definition: JSON.stringify(definition) });
    graph = (await core.getSenderoGraph(graph.sendero.id, graph.version.version))!;
    expect(graph.version).toMatchObject({ status: 'draft', maxActivations: 10, protocolVersion: 2 });
    expect(graph.nodes.every(node => node.agentSnapshotJson === null)).toBe(true);
    expect(graph.edges).toHaveLength(3);
    await submit({ intent: 'publish-sendero', ...reviewedGraph(graph) });
    graph = (await core.getSenderoGraph(graph.sendero.id, graph.version.version))!;
    const reviewNode = graph.nodes.find(node => node.agentId === reviewer.id)!;
    expect(reviewNode).toMatchObject({ executionObjective: 'Verify keyboard and responsive acceptance.', completionJson: '{"requireReview":true,"evidenceKinds":["test"]}' });
    expect(JSON.parse(reviewNode.agentSnapshotJson!)).toMatchObject({ id: reviewer.id, instructions: reviewer.definitionBody });
    const goal = await createGoal(project.id, graph, 'Ship the accessible launch page');
    expect(goal).toMatchObject({ status: 'draft', projectId: project.id, senderoVersionId: graph.version.id, kind: 'feature', specText: 'Keyboard and responsive acceptance must pass.' });
    expect((await db.execute({ sql: 'SELECT * FROM runs WHERE goal_id = ?', args: [goal.id] })).rows).toHaveLength(0);

    // New agent instructions and a published successor cannot alter this goal.
    await submit({ intent: 'update-agent', agentId: reviewer.id, slug: reviewer.slug, name: reviewer.name, instructions: 'New instructions for later goals.', status: 'active' });
    await submit({ intent: 'draft-sendero', senderoId: graph.sendero.id });
    const successor = (await server.missionControlData()).draftGraphs.find(item => item.sendero.id === graph.sendero.id)!;
    await submit({ intent: 'publish-sendero', ...reviewedGraph(successor) });
    const publishedSuccessor = (await core.getSenderoGraph(graph.sendero.id, successor.version.version))!;
    expect(publishedSuccessor.version.status).toBe('published');
    expect(JSON.parse(publishedSuccessor.nodes.find(node => node.agentId === reviewer.id)!.agentSnapshotJson!)).toMatchObject({ instructions: 'New instructions for later goals.' });
    expect((await core.getSenderoGraph(graph.sendero.id, graph.version.version))?.nodes).toEqual(graph.nodes);
    expect((await core.getGoal(goal.id))?.senderoVersionId).toBe(graph.version.id);

    await submit({ intent: 'start', goalId: goal.id });
    const activated = await server.missionControlData();
    const activation = activated.activations.find(item => item.goalId === goal.id)!;
    expect(activation).toMatchObject({ status: 'ready', revision: 0, latestRunId: null, attemptsUsed: 0 });
    expect(activated.goals.find(item => item.id === goal.id)?.status).toBe('active');
    expect(activated.runs.filter(run => run.goalId === goal.id)).toHaveLength(0);
    const beforePreview = await persistedSnapshot();
    await submit({ intent: 'start', goalId: goal.id });
    await server.missionControlData(); // Reopening/closing a plan reserves nothing.
    expect(await persistedSnapshot()).toEqual(beforePreview);

    const first = (await reserve(project.id, goal.id)).reservations[0]!;
    expect(first.run).toMatchObject({ activationId: activation.id, senderoVersionId: graph.version.id });
    const builderHost = await host(project.id, first.attempt.id);
    expect(builderHost.claim.packet).toMatchObject({ senderoVersionId: graph.version.id, agent: { id: builder.id, instructions: builder.definitionBody } });
    await builderHost.api.commands.attempts.update(first.attempt.id, { token: builderHost.claim.token, status: 'succeeded', result: { built: true } });
    const second = (await reserve(project.id, goal.id)).reservations[0]!;
    expect(second.run.activationId).not.toBe(first.run.activationId);
    expect(second.attempt).toMatchObject({ agentId: reviewer.id, attemptNumber: 1, retryFromAttemptId: null });
    const firstReviewerHost = await host(project.id, second.attempt.id);
    expect(firstReviewerHost.claim.packet).toMatchObject({ agent: { instructions: reviewer.definitionBody }, previous: { attemptId: first.attempt.id }, activation: { nodeId: reviewNode.id } });
    await firstReviewerHost.api.commands.attempts.update(second.attempt.id, { token: firstReviewerHost.claim.token, status: 'succeeded', result: { outcome: 'accepted', report: 'First review' } });
    expect(await core.getAttempt(second.attempt.id)).toMatchObject({ status: 'paused', finishedAt: null });
    await submit({ intent: 'evidence', attemptId: second.attempt.id, label: 'Manual first-pass report', url: 'https://example.test/first-review' });
    expect((await core.getAttempt(second.attempt.id))?.status).toBe('paused');
    await submit({ intent: 'review', attemptId: second.attempt.id, status: 'changes_requested', rationale: 'Keyboard checks need correction.' });
    expect((await core.getAttempt(second.attempt.id))?.status).toBe('failed');

    const retryPlan = (await server.missionControlData()).queue.dispatchable.find(item => item.goalId === goal.id)!;
    expect(retryPlan).toMatchObject({ activationId: second.run.activationId, agentId: reviewer.id, previousRunId: second.run.id });
    const retry = (await reserve(project.id, goal.id)).reservations[0]!;
    expect(retry.run.activationId).toBe(second.run.activationId);
    expect(retry.attempt).toMatchObject({ retryFromAttemptId: second.attempt.id, attemptNumber: 2, agentId: reviewer.id });
    expect(retry.attempt.retryFromAttemptId).not.toBe(first.attempt.id);
    const retryHost = await host(project.id, retry.attempt.id);
    expect(retryHost.claim.packet).toMatchObject({ previous: { attemptId: second.attempt.id }, activation: { id: second.run.activationId, nodeId: reviewNode.id } });
    await submit({ intent: 'evidence', attemptId: retry.attempt.id, label: 'Keyboard and responsive report', url: 'https://example.test/acceptance' });
    await submit({ intent: 'review', attemptId: retry.attempt.id, status: 'approved', rationale: 'Verified the corrected keyboard path.' });
    expect(await core.getAttempt(retry.attempt.id)).toMatchObject({ status: 'running', finishedAt: null });
    const completedResult = { outcome: 'accepted', report: 'Corrected review' };
    await retryHost.api.commands.attempts.update(retry.attempt.id, { token: retryHost.claim.token, status: 'succeeded', result: completedResult });
    let pending = (await core.getAttempt(retry.attempt.id))!;
    expect(pending).toMatchObject({ status: 'paused', finishedAt: null });
    expect(JSON.parse(pending.statusSnapshotJson)).toMatchObject({ completionRequested: true, review: { status: 'approved', reviewer: 'Studio operator', rationale: 'Verified the corrected keyboard path.', reviewedAt: expect.any(String) }, evidence: [{ kind: 'manual', label: 'Keyboard and responsive report', url: 'https://example.test/acceptance', id: expect.any(String), createdAt: expect.any(String) }] });
    await submit({ intent: 'evidence', attemptId: retry.attempt.id, label: 'Another manual check cannot count as a test', url: '' });
    pending = (await core.getAttempt(retry.attempt.id))!;
    expect(pending.status).toBe('paused');
    expect((await core.getGoal(goal.id))?.status).not.toBe('completed');
    await retryHost.api.commands.attempts.recordEvidence({ attemptId: retry.attempt.id, token: retryHost.claim.token, kind: 'test', label: 'External host acceptance test', summary: 'Keyboard and responsive checks passed.' });
    const reloaded = await server.missionControlData();
    const finished = reloaded.attempts.find(item => item.id === retry.attempt.id)!;
    expect(finished).toMatchObject({ status: 'succeeded', finishedAt: expect.any(String), externalSessionId: retryHost.externalSessionId });
    expect(JSON.parse(finished.resultJson)).toEqual(completedResult);
    expect(JSON.parse(finished.statusSnapshotJson).evidence.map((item: { kind: string }) => item.kind)).toEqual(['manual', 'manual', 'test']);
    expect(reloaded.goals.find(item => item.id === goal.id)).toMatchObject({ status: 'completed', senderoVersionId: graph.version.id });
    expect(reloaded.runs.filter(run => run.goalId === goal.id)).toHaveLength(3);
    expect(reloaded.activations.filter(item => item.goalId === goal.id)).toHaveLength(2);
    expect(JSON.stringify(reloaded)).not.toContain(retryHost.claim.token);
    const events = reloaded.events.filter(event => event.entityId === retry.attempt.id);
    expect(events.map(event => event.eventType)).toEqual(expect.arrayContaining(['attempt.claimed', 'attempt.started', 'run-attempt.evidence-recorded', 'run-attempt.reviewed', 'run-attempt.updated']));
    expect(events.find(event => event.eventType === 'run-attempt.reviewed')?.payload).toMatchObject({ status: 'approved', reviewer: 'Studio operator', rationale: 'Verified the corrected keyboard path.' });
    expect(events.find(event => event.eventType === 'run-attempt.evidence-recorded')?.payload).toMatchObject({ kind: 'manual', label: 'Keyboard and responsive report', url: 'https://example.test/acceptance' });
    expect(reloaded.events.find(event => event.entityId === goal.id && event.eventType === 'goal.step-succeeded' && event.payload.attemptId === retry.attempt.id)?.payload).toMatchObject({ attemptId: retry.attempt.id, activationId: second.run.activationId });
    expect(reloaded.events.filter(event => event.entityId === goal.id && event.eventType === 'goal.step-dispatched')).toHaveLength(3);

    const terminal = await persistedSnapshot();
    const invalidTerminal: Array<Record<string, string>> = [
      { intent: 'evidence', attemptId: retry.attempt.id, label: 'Too late', url: '' },
      { intent: 'review', attemptId: retry.attempt.id, status: 'rejected', rationale: 'Too late' },
      { intent: 'start', goalId: goal.id },
      { intent: 'stop', runId: retry.run.id },
    ];
    for (const values of invalidTerminal) {
      await expect(submit(values)).rejects.toThrow();
      expect(await persistedSnapshot()).toEqual(terminal);
    }
    await expect(retryHost.api.commands.attempts.update(retry.attempt.id, { token: retryHost.claim.token, status: 'succeeded', result: { outcome: 'different' } })).rejects.toThrow(/immutable/);
    expect(await persistedSnapshot()).toEqual(terminal);
  }, 30_000);

  it('keeps parallel sibling cancellation pending until every external host acknowledges', async () => {
    const { project } = await projectFixture();
    const agent = await createAgent('Parallel reviewer');
    const graph = await importGraph(agent.id, true);
    const startNode = graph.nodes.find(node => node.kind === 'start')!;
    expect(graph.nodes.find(node => node.label === 'Join')?.joinForkNodeId).toBe(startNode.id);
    const goal = await createGoal(project.id, graph);
    await submit({ intent: 'start', goalId: goal.id });
    const initial = await server.missionControlData();
    expect(initial.activations.filter(item => item.goalId === goal.id)).toHaveLength(2);
    expect(initial.runs.filter(run => run.goalId === goal.id)).toHaveLength(0);
    const selected = initial.queue.dispatchable.filter(item => item.goalId === goal.id).map(reviewDispatch);
    const unchanged = await persistedSnapshot();
    for (const items of [
      [selected[0], selected[0]],
      selected.map((item, index) => ({ ...item, revision: item.revision + index })),
      selected.map((item, index) => index ? { ...item, agentId: 'different-agent' } : item),
      selected.map((item, index) => index ? { ...item, activationId: 'missing-activation' } : item),
    ]) {
      await expect(server.applyMissionControlAction(form({ intent: 'dispatch-plan', scope: JSON.stringify({ projectId: project.id }), reviewedItems: JSON.stringify(items) }), { projectId: project.id })).rejects.toThrow();
      expect(await persistedSnapshot()).toEqual(unchanged);
    }
    const { reviewed, reservations } = await reserve(project.id, goal.id, 2);
    expect(new Set(reviewed.map(item => item.activationId)).size).toBe(2);
    const [left, right] = reservations;
    const leftHost = await host(project.id, left!.attempt.id);
    const rightHost = await host(project.id, right!.attempt.id);
    expect(leftHost.externalSessionId).not.toBe(rightHost.externalSessionId);
    expect(leftHost.claim.packet.activation.id).not.toBe(rightHost.claim.packet.activation.id);
    for (const { attempt } of reservations) {
      await submit({ intent: 'evidence', attemptId: attempt.id, label: `Pending review for ${attempt.id}`, url: `https://example.test/review/${attempt.id}` });
    }
    const pendingReviews = await server.missionControlData();
    const archivedSnapshots = new Map(reservations.map(({ attempt }) => [attempt.id, pendingReviews.attempts.find(item => item.id === attempt.id)!.statusSnapshotJson]));
    for (const { attempt } of reservations) {
      expect(pendingReviews.queue.reviews.find(item => item.attempt.id === attempt.id)).toMatchObject({ attempt: { status: 'running' }, review: { status: 'pending' } });
      expect(JSON.parse(archivedSnapshots.get(attempt.id)!)).toMatchObject({ review: { status: 'pending' }, evidence: [{ kind: 'manual', label: `Pending review for ${attempt.id}`, url: `https://example.test/review/${attempt.id}` }] });
    }
    await submit({ intent: 'stop', runId: left!.run.id });
    let data = await server.missionControlData();
    expect(data.goals.find(item => item.id === goal.id)?.status).toBe('blocked');
    expect(data.queue.dispatchable.filter(item => item.goalId === goal.id)).toHaveLength(0);
    for (const { attempt } of reservations) {
      expect(data.attempts.find(item => item.id === attempt.id)).toMatchObject({ status: 'running', finishedAt: null, cancellationRequestedAt: expect.any(String) });
      expect(data.queue.reviews.some(item => item.attempt.id === attempt.id)).toBe(true);
    }
    const beforeForbiddenFinish = await persistedSnapshot();
    await expect(leftHost.api.commands.attempts.update(left!.attempt.id, { token: leftHost.claim.token, status: 'succeeded', result: { done: true } })).rejects.toThrow(/cancel/i);
    expect(await persistedSnapshot()).toEqual(beforeForbiddenFinish);
    await leftHost.api.commands.attempts.update(left!.attempt.id, { token: leftHost.claim.token, status: 'canceled' });
    data = await server.missionControlData();
    expect(data.goals.find(item => item.id === goal.id)?.status).toBe('blocked');
    expect(data.attempts.find(item => item.id === right!.attempt.id)?.status).toBe('running');
    expect(data.queue.reviews.some(item => item.attempt.id === left!.attempt.id)).toBe(false);
    expect(data.queue.reviews.some(item => item.attempt.id === right!.attempt.id)).toBe(true);
    await rightHost.api.commands.attempts.update(right!.attempt.id, { token: rightHost.claim.token, status: 'canceled' });
    data = await server.missionControlData();
    expect(data.goals.find(item => item.id === goal.id)?.status).toBe('canceled');
    for (const { attempt } of reservations) {
      expect(data.attempts.find(item => item.id === attempt.id)).toMatchObject({ status: 'canceled', finishedAt: expect.any(String), statusSnapshotJson: archivedSnapshots.get(attempt.id) });
      expect(data.queue.reviews.some(item => item.attempt.id === attempt.id)).toBe(false);
      expect((await db.execute({ sql: 'SELECT status_snapshot_json FROM run_attempts WHERE id = ?', args: [attempt.id] })).rows[0]?.status_snapshot_json).toBe(archivedSnapshots.get(attempt.id));
      expect((await db.execute({ sql: 'SELECT cancellation_requested_at, acknowledged_at FROM attempt_claims WHERE attempt_id = ?', args: [attempt.id] })).rows[0]).toMatchObject({ cancellation_requested_at: expect.any(String), acknowledged_at: expect.any(String) });
    }
    // The actionable filtering is Studio-only; core inspection retains history.
    const coreOverview = await core.createSenderos({ allExecutionContexts: true }).missionControl.overview();
    for (const { attempt } of reservations) {
      expect(coreOverview.queue.reviews.find(item => item.attempt.id === attempt.id)).toMatchObject({ attempt: { status: 'canceled', statusSnapshotJson: archivedSnapshots.get(attempt.id) }, review: { status: 'pending' } });
    }
    expect(data.activations.filter(item => item.goalId === goal.id).every(item => item.status === 'canceled')).toBe(true);
    expect(data.activations.some(item => item.goalId === goal.id && item.nodeId === graph.nodes.find(node => node.label === 'Join')!.id)).toBe(false);
    const terminal = await persistedSnapshot();
    await submit({ intent: 'stop', runId: right!.run.id });
    expect(await persistedSnapshot()).toEqual(terminal);
  }, 30_000);

  it.each(['review-first', 'test-first'] as const)('settles host-completed gates only after both typed test evidence and approval (%s)', async order => {
    const { project } = await projectFixture();
    const agent = await createAgent(`Gate ${order}`);
    const graph = await importGraph(agent.id, false, true);
    const goal = await createGoal(project.id, graph);
    await submit({ intent: 'start', goalId: goal.id });
    const { attempt } = (await reserve(project.id, goal.id)).reservations[0]!;
    const external = await host(project.id, attempt.id);
    await external.api.commands.attempts.update(attempt.id, { token: external.claim.token, status: 'succeeded', result: { accepted: true } });
    await submit({ intent: 'evidence', attemptId: attempt.id, label: 'Manual observation', url: 'https://example.test/manual' });
    expect((await core.getAttempt(attempt.id))?.status).toBe('paused');
    const review = () => submit({ intent: 'review', attemptId: attempt.id, status: 'approved', rationale: 'Independent operator verification.' });
    const test = () => external.api.commands.attempts.recordEvidence({ attemptId: attempt.id, token: external.claim.token, kind: 'test', label: 'Host test results' });
    await (order === 'review-first' ? review() : test());
    expect((await core.getAttempt(attempt.id))?.status).toBe('paused');
    expect((await core.getGoal(goal.id))?.status).not.toBe('completed');
    await (order === 'review-first' ? test() : review());
    const data = await server.missionControlData();
    expect(data.attempts.find(item => item.id === attempt.id)?.status).toBe('succeeded');
    expect(data.goals.find(item => item.id === goal.id)?.status).toBe('completed');
  }, 30_000);

  it('rejects invalid forms atomically, isolates project edits and cancels unclaimed reservations immediately', async () => {
    const { project } = await projectFixture();
    const { project: other } = await projectFixture();
    const agent = await createAgent('Validation reviewer');
    const graph = await importGraph(agent.id);
    await submit({ intent: 'draft-sendero', senderoId: graph.sendero.id });
    const draft = (await server.missionControlData()).draftGraphs.find(item => item.sendero.id === graph.sendero.id)!;
    const goal = await createGoal(project.id, graph);
    await submit({ intent: 'start', goalId: goal.id });
    const { attempt, run } = (await reserve(project.id, goal.id)).reservations[0]!;
    const create = { intent: 'create-goal', projectId: project.id, title: 'Invalid goal', kind: 'feature', specText: 'No partial write', senderoVersionId: graph.version.id };
    const update = { intent: 'update-project', projectId: project.id, name: 'Would change project', targetBranch: 'preview', integrationMode: 'local_merge' };
    const invalidForms: Array<Record<string, string>> = [
      { intent: 'no-op' },
      { ...create, title: '   ' },
      { ...create, projectId: 'missing-project' },
      { ...create, senderoVersionId: draft.version.id },
      { ...update, name: '  ' },
      { ...update, targetBranch: '' },
      { ...update, integrationMode: 'unsupported' },
      { intent: 'create-agent', slug: agent.slug, name: 'Duplicate', instructions: 'Duplicate slug', status: 'active' },
      { intent: 'create-agent', slug: 'invalid slug', name: 'Invalid slug', instructions: 'No mutation', status: 'active' },
      { intent: 'update-agent', agentId: agent.id, slug: agent.slug, name: agent.name, instructions: 'Changed body', status: 'unsupported' },
      { intent: 'import-sendero', definition: '{broken' },
      { intent: 'import-sendero', definition: JSON.stringify({ slug: 'invalid-graph', name: 'No partial graph', nodes: [{ key: 'start', kind: 'start', label: 'Start' }], edges: [] }) },
      { intent: 'evidence', attemptId: attempt.id, label: '', url: '' },
      { intent: 'evidence', attemptId: attempt.id, label: 'Unsafe', url: 'javascript:alert(1)' },
      { intent: 'evidence', attemptId: 'missing-attempt', label: 'Missing', url: '' },
      { intent: 'review', attemptId: attempt.id, status: 'invalid', rationale: 'Must not mutate' },
    ];
    for (const values of invalidForms) {
      const before = await persistedSnapshot();
      await expect(submit(values), JSON.stringify(values)).rejects.toThrow();
      expect(await persistedSnapshot(), JSON.stringify(values)).toEqual(before);
    }
    await submit({ intent: 'update-project', projectId: other.id, name: 'Next campaign', targetBranch: 'campaign-preview', integrationMode: 'local_merge' });
    const data = await server.missionControlData();
    expect(data.projects.find(item => item.id === project.id)).toEqual(project);
    expect(data.projects.find(item => item.id === other.id)).toMatchObject({ name: 'Next campaign', targetBranch: 'campaign-preview', integrationMode: 'local_merge', githubOwner: other.githubOwner, githubRepo: other.githubRepo, executionContextId: other.executionContextId, canonicalPath: other.canonicalPath });
    await submit({ intent: 'stop', runId: run.id });
    const stopped = await server.missionControlData();
    expect(stopped.goals.find(item => item.id === goal.id)?.status).toBe('canceled');
    expect(stopped.attempts.find(item => item.id === attempt.id)).toMatchObject({ status: 'canceled', ownerId: null, externalSessionId: null, startedAt: null, finishedAt: expect.any(String) });
    expect((await db.execute({ sql: 'SELECT owner_id, claimed_at, parent_session_id FROM attempt_claims WHERE attempt_id = ?', args: [attempt.id] })).rows[0]).toMatchObject({ owner_id: null, claimed_at: null, parent_session_id: null });
  }, 30_000);
});
