import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { RouterContextProvider } from 'react-router';

const root = resolve(process.env.SENDEROS_TEST_RUNTIME_ROOT ?? resolve(import.meta.dirname, '../../../../../.tmp/test-runtime'), `studio-reviewer-${crypto.randomUUID()}`);
mkdirSync(root, { recursive: true });
process.env.SENDEROS_DATABASE_URL = `file:${resolve(root, 'reviewer.db')}`;

const form = (input: Record<string, string>) => {
  const value = new FormData();
  for (const [key, item] of Object.entries(input)) value.set(key, item);
  return value;
};

describe('independent Studio action audit regressions', () => {
  let server: typeof import('./server');
  let core: typeof import('@senderos/core');
  let authoring: typeof import('./graph-authoring');
  beforeAll(async () => {
    server = await import('./server');
    core = await import('@senderos/core');
    authoring = await import('./graph-authoring');
    await server.missionControlData();
  });
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  async function createDefinition() {
    const agent = await core.createAgent({ slug: `review-agent-${crypto.randomUUID()}`, name: 'Review agent', instructions: 'Review requested work.' });
    return core.newSendero({ slug: `review-${crypto.randomUUID()}`, name: 'Reviewer workflow', nodes: [
      { key: 'start', kind: 'start', label: 'Start' },
      { key: 'work', kind: 'agent', label: 'Work', agentId: agent.id, executionObjective: 'Review the work.', completion: { requireReview: true, evidenceKinds: ['test'] }, requirements: ['browser'] },
      { key: 'end', kind: 'end', label: 'End' },
    ], edges: [{ key: 'begin', source: 'start', target: 'work' }, { key: 'finish', source: 'work', target: 'end' }] });
  }

  function reviewedFields(graph: Awaited<ReturnType<typeof createDefinition>>) {
    const revision = (graph as { revision?: string }).revision;
    expect(revision).toBeTruthy();
    return { senderoId: graph.sendero.id, expectedVersionId: graph.version.id, expectedRevision: revision! };
  }

  it('rejects URL/form scope mismatch and stale activation IDs through the actual action route', async () => {
    const { action } = await import('../../routes/home');
    const { reviewDispatch } = await import('./dispatch-review');
    const graph = await createDefinition();
    await core.publishSendero(graph.sendero.id);
    const ready: Array<{ goal: { id: string } }> = [];
    for (const id of ['review-context-a', 'review-context-b']) {
      await core.registerExecutionContext({ id, name: id });
      const scoped = core.createSenderos({ executionContextId: id });
      const project = await scoped.commands.projects.create({ id: `${id}-project`, name: id, canonicalPath: '/tmp/review', githubOwner: 'review', githubRepo: 'review' });
      const goal = await scoped.commands.goals.create({ projectId: project.id, title: id, kind: 'research', senderoVersionId: graph.version.id });
      await scoped.commands.goals.activate(goal.id);
      ready.push({ goal });
    }
    const all = core.createSenderos({ allExecutionContexts: true });
    const plan = await all.commands.plan();
    const selected = plan.filter(item => item.goalId === ready[0]!.goal.id).map(reviewDispatch);
    const routeUrl = new URL('http://localhost/canvas?context=review-context-a');
    const submit = async (body: FormData) => action({ request: new Request(routeUrl, { method: 'POST', body }), url: routeUrl, pattern: '/canvas', params: {}, context: new RouterContextProvider() });
    const before = (await all.commands.runs.list()).length;
    const forged = form({ intent: 'dispatch-plan', scope: JSON.stringify({ executionContextId: 'review-context-b' }), reviewedItems: JSON.stringify(selected) });
    expect(await submit(forged)).toMatchObject({ ok: false });
    forged.set('scope', JSON.stringify({ executionContextId: 'review-context-a' }));
    forged.set('reviewedItems', JSON.stringify(selected.map(item => ({ ...item, activationId: 'stale-activation' }))));
    expect(await submit(forged)).toMatchObject({ ok: false });
    expect((await all.commands.runs.list()).length).toBe(before);
    forged.set('reviewedItems', JSON.stringify(selected));
    expect(await submit(forged)).toMatchObject({ ok: true });
    expect((await all.commands.runs.list()).filter(run => run.goalId === ready[1]!.goal.id)).toHaveLength(0);
  });

  it('rejects malformed graph replacement atomically without changing existing policies', async () => {
    const graph = await createDefinition();
    const valid = authoring.graphDefinition(authoring.graphDraft(graph));
    for (const patch of [
      { nodes: valid.nodes.map(node => node.kind === 'agent' ? { ...node, completionJson: '{"requireReview":"yes"}' } : node) },
      { nodes: valid.nodes.map(node => node.kind === 'agent' ? { ...node, requirementsJson: '[" "]' } : node) },
      { nodes: [...valid.nodes, valid.nodes[1]] },
      { edges: valid.edges.map(edge => ({ ...edge, target: 'missing-node' })) },
    ]) {
      await expect(server.applyMissionControlAction(form({ intent: 'replace-sendero-draft', ...reviewedFields(graph), definition: JSON.stringify({ ...valid, ...patch }) }))).rejects.toThrow();
      const current = await core.getSenderoGraph(graph.sendero.id, graph.version.version);
      expect(current?.nodes).toEqual(graph.nodes);
      expect(current?.edges).toEqual(graph.edges);
    }
  });

  it('round-trips repeated draft saves without replacing identities or clearing nonempty node policies', async () => {
    const graph = await createDefinition();
    const draft = authoring.graphDraft(graph);
    const work = draft.nodes.find(node => node.kind === 'agent')!;
    work.label = 'Updated label';
    draft.edges.find(edge => edge.source === work.key)!.conditionJson = '{"outcome":"accepted"}';
    let reviewed = graph;
    for (let save = 0; save < 2; save++) {
      await server.applyMissionControlAction(form({ intent: 'replace-sendero-draft', ...reviewedFields(reviewed), definition: JSON.stringify(authoring.graphDefinition(draft)) }));
      const current = (await core.getSenderoGraph(graph.sendero.id, graph.version.version))!;
      reviewed = current;
      expect(current.nodes.map(node => node.id)).toEqual(graph.nodes.map(node => node.id));
      expect(current.edges.map(edge => edge.id)).toEqual(graph.edges.map(edge => edge.id));
      expect(current.nodes.find(node => node.id === work.key)).toMatchObject({ executionObjective: 'Review the work.', completionJson: '{"requireReview":true,"evidenceKinds":["test"]}', requirementsJson: '["browser"]' });
    }
  });

  it('does not publish a successor draft from a stale reviewed version', async () => {
    const reviewed = await createDefinition();
    await core.publishSendero(reviewed.sendero.id);
    const successor = (await core.draftSendero(reviewed.sendero.id))!;
    await expect(server.applyMissionControlAction(form({ intent: 'publish-sendero', ...reviewedFields(reviewed) }))).rejects.toThrow();
    expect((await core.getSenderoGraph(reviewed.sendero.id, successor.version.version))?.version.status).toBe('draft');
  });

  it('keeps the complete graph unpublished when routing validation fails', async () => {
    const graph = await createDefinition();
    const draft = authoring.graphDraft(graph);
    draft.edges[0]!.conditionJson = '{"outcome":"unsupported-on-start"}';
    await server.applyMissionControlAction(form({ intent: 'replace-sendero-draft', ...reviewedFields(graph), definition: JSON.stringify(authoring.graphDefinition(draft)) }));
    const reviewed = (await core.getSenderoGraph(graph.sendero.id, graph.version.version))!;
    await expect(server.applyMissionControlAction(form({ intent: 'publish-sendero', ...reviewedFields(reviewed) }))).rejects.toThrow();
    const unchanged = (await core.getSenderoGraph(graph.sendero.id, graph.version.version))!;
    expect(unchanged.version.status).toBe('draft');
    expect(unchanged.nodes.every(node => node.agentSnapshotJson === null)).toBe(true);
  });

  it('rejects stale save and publish after another tab changes the same draft version', async () => {
    const reviewed = await createDefinition();
    const changed = authoring.graphDraft(reviewed);
    changed.nodes.find(node => node.kind === 'agent')!.label = 'Other tab edit';
    await server.applyMissionControlAction(form({ intent: 'replace-sendero-draft', ...reviewedFields(reviewed), definition: JSON.stringify(authoring.graphDefinition(changed)) }));
    await expect(server.applyMissionControlAction(form({ intent: 'publish-sendero', ...reviewedFields(reviewed) }))).rejects.toThrow();
    await expect(server.applyMissionControlAction(form({ intent: 'replace-sendero-draft', ...reviewedFields(reviewed), definition: JSON.stringify(authoring.graphDefinition(authoring.graphDraft(reviewed))) }))).rejects.toThrow();
    const current = (await core.getSenderoGraph(reviewed.sendero.id, reviewed.version.version))!;
    expect(current.version.status).toBe('draft');
    expect(current.nodes.find(node => node.kind === 'agent')!.label).toBe('Other tab edit');
  });

  it('requires another review before publishing newly changed agent instructions', async () => {
    const reviewed = await createDefinition();
    const agentId = reviewed.nodes.find(node => node.kind === 'agent')!.agentId!;
    await core.updateAgent({ id: agentId, instructions: 'Different instructions changed by another editor.' });
    await expect(server.applyMissionControlAction(form({ intent: 'publish-sendero', ...reviewedFields(reviewed) }))).rejects.toThrow();
    const current = (await core.getSenderoGraph(reviewed.sendero.id, reviewed.version.version))!;
    expect(current.version.status).toBe('draft');
    await server.applyMissionControlAction(form({ intent: 'publish-sendero', ...reviewedFields(current) }));
    const published = (await core.getSenderoGraph(reviewed.sendero.id, reviewed.version.version))!;
    expect(published.version.status).toBe('published');
    expect(published.nodes.find(node => node.kind === 'agent')?.agentSnapshotJson).toContain('Different instructions');
  });

  it('rejects stale inspector node and edge policy edits without overwriting the newer draft', async () => {
    const reviewed = await createDefinition();
    const changed = authoring.graphDraft(reviewed);
    const work = changed.nodes.find(node => node.kind === 'agent')!;
    work.label = 'Current node label';
    const edge = changed.edges.find(edge => edge.source === work.key)!;
    edge.conditionJson = '{"outcome":"accepted","completion":{"requireReview":true,"evidenceKinds":["test"]}}';
    await server.applyMissionControlAction(form({ intent: 'replace-sendero-draft', ...reviewedFields(reviewed), definition: JSON.stringify(authoring.graphDefinition(changed)) }));
    const current = (await core.getSenderoGraph(reviewed.sendero.id, reviewed.version.version))!;
    await expect(server.applyMissionControlAction(form({ intent: 'update-sendero-node', ...reviewedFields(reviewed), nodeId: work.key, label: 'Stale overwrite' }))).rejects.toThrow(/changed/);
    await expect(server.applyMissionControlAction(form({ intent: 'update-sendero-edge', ...reviewedFields(reviewed), edgeId: edge.key, name: 'Stale edge', description: '', transitionObjective: '', conditionJson: '{}', evidenceKinds: '', status: 'active' }))).rejects.toThrow(/changed/);
    const unchanged = (await core.getSenderoGraph(reviewed.sendero.id, reviewed.version.version))!;
    expect(unchanged.nodes).toEqual(current.nodes);
    expect(unchanged.edges).toEqual(current.edges);
  });

  it('rejects a partially invalid or cross-graph layout without moving any node', async () => {
    const graph = await createDefinition();
    const other = await createDefinition();
    const first = graph.nodes[0]!;
    const second = graph.nodes[1]!;
    for (const invalid of [
      { [second.id]: { x: 'invalid', y: 100 } },
      { [other.nodes[0]!.id]: { x: 300, y: 100 } },
    ]) {
      await expect(server.applyMissionControlAction(form({ intent: 'update-sendero-layout', ...reviewedFields(graph), positions: JSON.stringify({ [first.id]: { x: first.positionX + 40, y: first.positionY + 40 }, ...invalid }) }))).rejects.toThrow(/Layout positions/);
      expect((await core.getSenderoGraph(graph.sendero.id, graph.version.version))?.nodes).toEqual(graph.nodes);
      expect((await core.getSenderoGraph(other.sendero.id, other.version.version))?.nodes).toEqual(other.nodes);
    }
  });
});
