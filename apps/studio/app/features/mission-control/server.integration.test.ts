import { afterAll, describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { RouterContextProvider } from "react-router";

const testRuntimeBase = resolve(
  process.env.SENDEROS_TEST_RUNTIME_ROOT ??
    resolve(import.meta.dirname, "../../../../../.tmp/test-runtime"),
);
const testRuntimeRoot = resolve(testRuntimeBase, "studio");
mkdirSync(testRuntimeRoot, { recursive: true });
const databasePath = join(testRuntimeRoot, `senderos-studio-${crypto.randomUUID()}.db`);
process.env.SENDEROS_DATABASE_URL = `file:${databasePath}`;

describe("Studio server integration", () => {
  afterAll(() => {
    rmSync(testRuntimeRoot, { recursive: true, force: true });
    if (existsSync(testRuntimeBase) && readdirSync(testRuntimeBase).length === 0) {
      rmSync(testRuntimeBase, { recursive: true, force: true });
    }
  });

  it("loads the shared database and applies every Studio intent", async () => {
    const { missionControlData, applyMissionControlAction } = await import("./server");
    const { senderosForStudio } = await import("../../server/senderos.server");
    await missionControlData();
    const senderos = senderosForStudio();
    const context = await (await import("@senderos/core")).registerExecutionContext({ id: "context-studio", name: "Studio test" });
    const scoped = (await import("@senderos/core")).createSenderos({ executionContextId: context.id });
    const project = await scoped.commands.projects.create({ id: "project-studio", name: "Studio project", canonicalPath: "/tmp/studio-project", githubOwner: "owner", githubRepo: "repo" });
    const graph = (await senderos.missionControl.senderos.listGraphs())[0]!;

    const create = new FormData();
    Object.entries({ intent: "create-goal", projectId: project.id, title: "Studio goal", kind: "feature", specText: "Ship it", senderoVersionId: graph.version.id }).forEach(([key, value]) => create.set(key, value));
    await applyMissionControlAction(create);
    let data = await missionControlData();
    const goal = data.goals.find((item) => item.title === "Studio goal")!;

    const start = new FormData(); start.set("intent", "start"); start.set("goalId", goal.id); await applyMissionControlAction(start);
    const plan = new FormData(); plan.set("intent", "dispatch-plan"); await expect(applyMissionControlAction(plan)).rejects.toThrow("scope");
    data = await missionControlData();
    const attempt = data.attempts.at(-1)!;

    const evidence = new FormData(); Object.entries({ intent: "evidence", attemptId: attempt.id, label: "Proof", url: "https://example.test/proof" }).forEach(([key, value]) => evidence.set(key, value)); await applyMissionControlAction(evidence);
    const review = new FormData(); Object.entries({ intent: "review", attemptId: attempt.id, status: "approved", rationale: "Looks good" }).forEach(([key, value]) => review.set(key, value)); await applyMissionControlAction(review);
    const evidenceWithoutUrl = new FormData(); Object.entries({ intent: "evidence", attemptId: attempt.id, label: "Local proof", url: "" }).forEach(([key, value]) => evidenceWithoutUrl.set(key, value)); await applyMissionControlAction(evidenceWithoutUrl);
    const reviewWithoutRationale = new FormData(); Object.entries({ intent: "review", attemptId: attempt.id, status: "changes_requested", rationale: "" }).forEach(([key, value]) => reviewWithoutRationale.set(key, value)); await applyMissionControlAction(reviewWithoutRationale);
    const stop = new FormData(); stop.set("intent", "stop"); stop.set("runId", attempt.runId); await applyMissionControlAction(stop);

    const updateProject = new FormData(); Object.entries({ intent: "update-project", projectId: project.id, name: "Updated project", targetBranch: "develop", integrationMode: "local_merge" }).forEach(([key, value]) => updateProject.set(key, value)); await applyMissionControlAction(updateProject);
    const node = graph.nodes[0]!;
    const position = new FormData(); Object.entries({ intent: "update-sendero-node-position", nodeId: node.id, senderoId: graph.sendero.id, expectedVersionId: graph.version.id, expectedRevision: graph.revision!, positionX: "111", positionY: "222" }).forEach(([key, value]) => position.set(key, value)); await applyMissionControlAction(position);
    const layout = new FormData(); layout.set("intent", "update-sendero-layout"); layout.set("senderoId", graph.sendero.id); layout.set("expectedVersionId", graph.version.id); layout.set("expectedRevision", (await (await import("@senderos/core")).getSenderoGraph(graph.sendero.id, graph.version.version))!.revision!); layout.set("positions", JSON.stringify({ [node.id]: { x: 333, y: 444 } })); await applyMissionControlAction(layout);
    const updateNode = new FormData(); Object.entries({ intent: "update-sendero-node", nodeId: node.id, expectedRevision: graph.revision!, label: "New start" }).forEach(([key, value]) => updateNode.set(key, value)); await expect(applyMissionControlAction(updateNode)).rejects.toThrow();
    const draftForm = new FormData(); draftForm.set('intent', 'draft-sendero'); draftForm.set('senderoId', graph.sendero.id); await applyMissionControlAction(draftForm);
    const draft = (await missionControlData()).draftGraphs[0]!;
    updateNode.set("nodeId", draft.nodes[0]!.id); updateNode.set("expectedRevision", draft.revision!); await applyMissionControlAction(updateNode);
    const edge = draft.edges[0]!;
    const updateEdge = new FormData(); Object.entries({ intent: "update-sendero-edge", edgeId: edge.id, expectedRevision: (await (await import("@senderos/core")).getSenderoGraph(graph.sendero.id, draft.version.version))!.revision!, name: "Updated arc", description: "Updated", transitionObjective: "Continue", status: "active", conditionJson: "{}", evidenceKinds: "test, artifact", requireReview: "on" }).forEach(([key, value]) => updateEdge.set(key, value)); await applyMissionControlAction(updateEdge);

    data = await missionControlData();
    const publishForm = new FormData(); publishForm.set('intent', 'publish-sendero'); publishForm.set('senderoId', graph.sendero.id); publishForm.set('expectedVersionId', draft.version.id); publishForm.set('expectedRevision', data.draftGraphs.find(item => item.version.id === draft.version.id)!.revision!); await applyMissionControlAction(publishForm);
    expect(data.projects.find((item) => item.id === project.id)).toMatchObject({ name: "Updated project", targetBranch: "develop" });
    expect(data.runtime.database).toMatchObject({ endpoint: "Local libSQL database", remote: false });
    expect(data.attempts.find((item) => item.id === attempt.id)?.statusSnapshotJson).toContain("changes_requested");

    const homeRoute = await import("../../routes/home");
    const routeContext = new RouterContextProvider();
    const routeUrl = new URL("http://localhost/");
    expect(await homeRoute.loader({ request: new Request(routeUrl), url: routeUrl, pattern: "/", params: {}, context: routeContext })).toMatchObject({ projects: data.projects });
    const noOp = new FormData(); noOp.set("intent", "no-op");
    expect(await homeRoute.action({ request: new Request(routeUrl, { method: "POST", body: noOp }), url: routeUrl, pattern: "/", params: {}, context: routeContext })).toMatchObject({ ok: true });
    const invalidImport = new FormData(); invalidImport.set('intent', 'import-sendero'); invalidImport.set('definition', '[]');
    expect(await homeRoute.action({ request: new Request(routeUrl, { method: 'POST', body: invalidImport }), url: routeUrl, pattern: '/', params: {}, context: routeContext })).toMatchObject({ ok: false, message: expect.stringContaining('valid JSON') });
    const agentForm = new FormData(); Object.entries({ intent: 'create-agent', name: 'Redirect agent', slug: 'redirect-agent', instructions: 'Follow the task' }).forEach(([key, value]) => agentForm.set(key, value));
    const response = await homeRoute.action({ request: new Request(routeUrl, { method: 'POST', body: agentForm }), url: routeUrl, pattern: '/', params: {}, context: routeContext });
    expect(response).toBeInstanceOf(Response);
    expect((response as Response).headers.get('Location')).toMatch(/^\/agents\//);
    const retry = new FormData(); retry.set('intent', 'retry'); retry.set('goalId', 'missing-goal');
    await expect(applyMissionControlAction(retry)).rejects.toThrow();

  }, 30_000);

  it("reserves only the reviewed context and rejects stale, empty, and forged batches atomically", async () => {
    const { missionControlData, applyMissionControlAction } = await import('./server');
    const { reviewDispatch } = await import('./dispatch-review');
    const core = await import('@senderos/core');
    await missionControlData();
    const all = core.createSenderos({ allExecutionContexts: true });
    const graph = (await all.missionControl.senderos.listGraphs())[0]!;
    const goals: Array<{ id: string; projectId: string }> = [];
    for (const contextId of ['scope-a', 'scope-a', 'scope-b']) {
      await core.registerExecutionContext({ id: contextId, name: contextId });
      const scoped = core.createSenderos({ executionContextId: contextId });
      const project = await scoped.commands.projects.create({ id: `project-${crypto.randomUUID()}`, name: `Scoped project ${crypto.randomUUID()}`, canonicalPath: '/tmp/scope', githubOwner: 'owner', githubRepo: 'scope' });
      const goal = await scoped.commands.goals.create({ projectId: project.id, title: 'Scoped goal', kind: 'research', senderoVersionId: graph.version.id });
      await scoped.commands.goals.activate(goal.id);
      goals.push(goal);
    }
    const initial = await all.commands.plan();
    const reviewed = initial.filter(item => goals.slice(0, 2).some(goal => goal.id === item.goalId));
    const form = new FormData();
    form.set('intent', 'dispatch-plan'); form.set('scope', JSON.stringify({ executionContextId: 'scope-a' })); form.set('reviewedItems', JSON.stringify(reviewed.map(reviewDispatch)));
    const runsBefore = (await all.commands.runs.list()).length;
    const forged = new FormData(); for (const [key, value] of form) forged.set(key, value);
    forged.set('reviewedItems', JSON.stringify(initial.filter(item => item.goalId === goals[2]!.id).map(reviewDispatch)));
    await expect(applyMissionControlAction(forged)).rejects.toThrow();
    await expect(applyMissionControlAction(form, { executionContextId: 'scope-b' })).rejects.toThrow('scope changed');
    expect((await all.commands.runs.list()).length).toBe(runsBefore);
    const stale = new FormData(); for (const [key, value] of form) stale.set(key, value);
    stale.set('reviewedItems', JSON.stringify(reviewed.map((item, index) => ({ ...reviewDispatch(item), revision: item.revision + index }))));
    await expect(applyMissionControlAction(stale)).rejects.toThrow();
    expect((await all.commands.runs.list()).length).toBe(runsBefore);
    await applyMissionControlAction(form, { executionContextId: 'scope-a' });
    const after = await all.commands.runs.list();
    expect(after.filter(run => goals.slice(0, 2).some(goal => goal.id === run.goalId))).toHaveLength(2);
    expect(after.filter(run => run.goalId === goals[2]!.id)).toHaveLength(0);
    await expect(applyMissionControlAction(form)).rejects.toThrow();
    expect((await all.commands.runs.list()).length).toBe(after.length);
    form.set('reviewedItems', '[]');
    await expect(applyMissionControlAction(form)).rejects.toThrow('empty');
  });

  it("creates and edits custom agents and imports, edits, and publishes directed graphs", async () => {
    const { missionControlData, applyMissionControlAction } = await import('./server');
    const form = (input: Record<string, string>) => { const form = new FormData(); Object.entries(input).forEach(([key, value]) => form.set(key, value)); return form; };
    await applyMissionControlAction(form({ intent: 'create-agent', slug: 'studio-researcher', name: 'Researcher', instructions: 'Research the supplied topic.', status: 'active' }));
    let data = await missionControlData();
    const agent = data.agents.find(agent => agent.slug === 'studio-researcher')!;
    expect(agent.kind).toBe('custom');
    await applyMissionControlAction(form({ intent: 'update-agent', agentId: agent.id, slug: agent.slug, name: 'Researcher revised', instructions: 'Cite primary sources.', status: 'active' }));
    await applyMissionControlAction(form({ intent: 'create-sendero', slug: 'studio-research', name: 'Research workflow' }));
    data = await missionControlData();
    const draft = data.draftGraphs.find(graph => graph.sendero.slug === 'studio-research')!;
    const definition = { maxActivations: 9, nodes: [
      { key: 'start', kind: 'start', label: 'Start' },
      { key: 'research', kind: 'agent', label: 'Research', agentId: agent.id, executionObjective: 'Produce supported findings', completion: { requireReview: true }, requirements: ['browser'] },
      { key: 'end', kind: 'end', label: 'End' },
    ], edges: [
      { key: 'begin', source: 'start', target: 'research', name: 'Begin' },
      { key: 'revise', source: 'research', target: 'research', name: 'Revise', condition: { outcome: 'revise' } },
      { key: 'finish', source: 'research', target: 'end', name: 'Finish', condition: { outcome: 'accepted' } },
    ] };
    await applyMissionControlAction(form({ intent: 'replace-sendero-draft', senderoId: draft.sendero.id, expectedVersionId: draft.version.id, expectedRevision: draft.revision!, definition: JSON.stringify(definition) }));
    const edited = (await missionControlData()).draftGraphs.find(graph => graph.sendero.id === draft.sendero.id)!;
    expect(edited.edges).toHaveLength(3);
    expect(edited.nodes.find(node => node.kind === 'agent')?.completionJson).toContain('requireReview');
    await expect(applyMissionControlAction(form({ intent: 'replace-sendero-draft', senderoId: draft.sendero.id, expectedVersionId: 'stale', expectedRevision: edited.revision!, definition: JSON.stringify(definition) }))).rejects.toThrow();
    await applyMissionControlAction(form({ intent: 'publish-sendero', senderoId: draft.sendero.id, expectedVersionId: draft.version.id, expectedRevision: edited.revision! }));
    await applyMissionControlAction(form({ intent: 'import-sendero', definition: JSON.stringify({ ...definition, slug: 'studio-imported', name: 'Imported research' }) }));
    data = await missionControlData();
    expect(data.historyGraphs.find(graph => graph.sendero.id === draft.sendero.id)?.version.status).toBe('published');
    expect(data.draftGraphs.find(graph => graph.sendero.slug === 'studio-imported')).toBeTruthy();
    expect(data.agents.find(item => item.id === agent.id)?.definitionBody).toBe('Cite primary sources.');
    const count = data.draftGraphs.length;
    await expect(applyMissionControlAction(form({ intent: 'import-sendero', definition: '{invalid' }))).rejects.toThrow('valid JSON');
    expect((await missionControlData()).draftGraphs).toHaveLength(count);
  });

  it("rejects mutation forms that omit their reviewed revision", async () => {
    const { applyMissionControlAction } = await import('./server');
    for (const intent of ['publish-sendero', 'update-sendero-node', 'update-sendero-edge', 'replace-sendero-draft', 'update-sendero-layout']) {
      const form = new FormData(); form.set('intent', intent); form.set('definition', '{}'); form.set('positions', '{}');
      await expect(applyMissionControlAction(form)).rejects.toThrow(/revision/);
    }
  });

  it("never includes ownership tokens in Studio hydration", async () => {
    const { missionControlData } = await import('./server');
    const core = await import('@senderos/core');
    const data = await missionControlData();
    const candidate = data.attempts.find(attempt => attempt.status === 'queued' && !attempt.cancellationRequestedAt)!;
    expect(candidate).toBeTruthy();
    const run = data.runs.find(run => run.id === candidate.runId)!;
    const goal = data.goals.find(goal => goal.id === run.goalId)!;
    const project = data.projects.find(project => project.id === goal.projectId)!;
    const scoped = core.createSenderos({ executionContextId: project.executionContextId });
    await scoped.commands.hosts.register({ id: 'studio-inspection-host', name: 'Inspection host', harness: 'test-host', capabilities: ['independent_session', 'browser', 'git', 'shell', 'filesystem', 'network'] });
    await scoped.commands.hosts.grant({ hostId: 'studio-inspection-host', projectId: project.id, workspaceRef: 'test-workspace' });
    await scoped.commands.hosts.workspace({ hostId: 'studio-inspection-host', projectId: project.id, available: true, workingPath: '/tmp/studio-inspection' });
    const claim = await scoped.commands.attempts.claim({ attemptId: candidate.id, ownerId: 'studio-inspection-host' });
    const inspected = await missionControlData();
    expect(inspected.attempts.find(attempt => attempt.id === candidate.id)?.ownerId).toBe('studio-inspection-host');
    expect(JSON.stringify(inspected)).not.toContain(claim.token);
    expect(JSON.stringify(inspected)).not.toContain('"token":');
  });

});
