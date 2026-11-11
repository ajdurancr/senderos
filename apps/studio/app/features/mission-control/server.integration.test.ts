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

  it("registers explicit local-data scopes and rejects invalid or duplicate setup without writes", async () => {
    const { applyMissionControlAction, missionControlData } = await import("./server");
    const submit = (values: Record<string, string>) => {
      const form = new FormData();
      Object.entries(values).forEach(([key, value]) => form.set(key, value));
      return applyMissionControlAction(form, { executionContextId: "unrelated-filter", projectId: "unrelated-project" });
    };
    const before = await missionControlData();
    await expect(submit({ intent: "register-context", name: "   " })).rejects.toThrow(/name/i);
    await expect(submit({ intent: "register-context", name: "x".repeat(201) })).rejects.toThrow(/200/);
    const result = await submit({ intent: "register-context", name: "  Studio setup  " });
    const registered = (await missionControlData()).executionContexts.find(item => item.name === "Studio setup")!;
    expect(registered).toBeTruthy();
    expect(result).toEqual({ redirectTo: `/settings?context=${encodeURIComponent(registered.id)}` });
    const afterContext = await missionControlData();
    expect(afterContext.executionContexts).toHaveLength(before.executionContexts.length + 1);
    expect(afterContext.projects).toEqual(before.projects);
    await expect(submit({ intent: "register-context", name: "Studio setup" })).rejects.toThrow(/already/i);
    for (const values of [
      { name: "", executionContextId: registered.id },
      { name: "Invalid scope", executionContextId: "unknown-context" },
      { name: "Missing scope", executionContextId: "" },
      { name: "x".repeat(201), executionContextId: registered.id },
    ]) await expect(submit({ intent: "register-project", ...values })).rejects.toThrow();
    expect((await missionControlData()).projects).toEqual(before.projects);
    const created = await submit({ intent: "register-project", name: "  Research notebook  ", executionContextId: registered.id, canonicalPath: "/ignored", githubOwner: "ignored", integrationMode: "github_pr" });
    const after = await missionControlData();
    const project = after.projects.find(item => item.name === "Research notebook")!;
    expect(project).toMatchObject({ executionContextId: registered.id, canonicalPath: "", integrationMode: "none", targetBranch: "", githubOwner: "", githubRepo: "" });
    expect(created).toEqual({ redirectTo: `/settings?context=${encodeURIComponent(registered.id)}&project=${encodeURIComponent(project.id)}` });
    expect(after.projects).toHaveLength(before.projects.length + 1);
    expect(after.runs).toEqual(before.runs);
    expect(after.hosts).toEqual(before.hosts);
    expect(after.goals).toEqual(before.goals);
    await expect(submit({ intent: "register-project", name: "Research notebook", executionContextId: registered.id })).rejects.toThrow(/already/i);
    expect((await missionControlData()).projects).toEqual(after.projects);
  });

  it("keeps concurrent duplicate registrations unique and reports a useful conflict", async () => {
    const { applyMissionControlAction, missionControlData } = await import("./server");
    const submit = (intent: string, name: string, executionContextId = "") => {
      const form = new FormData();
      Object.entries({ intent, name, executionContextId }).forEach(([key, value]) => form.set(key, value));
      return applyMissionControlAction(form);
    };
    const contexts = await Promise.allSettled([submit("register-context", "Concurrent setup"), submit("register-context", "Concurrent setup")]);
    expect(contexts.filter(item => item.status === "fulfilled")).toHaveLength(1);
    const contextConflict = contexts.find(item => item.status === "rejected") as PromiseRejectedResult;
    expect(contextConflict.reason.message).toMatch(/already/i);
    const context = (await missionControlData()).executionContexts.find(item => item.name === "Concurrent setup")!;
    const projects = await Promise.allSettled([submit("register-project", "Concurrent notebook", context.id), submit("register-project", "Concurrent notebook", context.id)]);
    expect(projects.filter(item => item.status === "fulfilled")).toHaveLength(1);
    const conflict = projects.find(item => item.status === "rejected") as PromiseRejectedResult;
    expect(conflict.reason.message).toMatch(/already/i);
    expect((await missionControlData()).projects.filter(item => item.name === "Concurrent notebook" && item.executionContextId === context.id)).toHaveLength(1);
  });

  it("persists empty branches only when repository integration is disabled and rejects invalid edits atomically", async () => {
    const { applyMissionControlAction, missionControlData } = await import("./server");
    const { createSenderos, registerExecutionContext } = await import("@senderos/core");
    await missionControlData();
    await registerExecutionContext({ id: "settings-optional-context", name: "Optional branch settings" });
    const api = createSenderos({ executionContextId: "settings-optional-context" });
    const project = await api.commands.projects.create({ name: "No repository settings" });
    const edit = (name: string, integrationMode: string, targetBranch = "") => {
      const form = new FormData();
      Object.entries({ intent: "update-project", projectId: project.id, name, integrationMode, targetBranch }).forEach(([key, value]) => form.set(key, value));
      return applyMissionControlAction(form);
    };
    await edit("Renamed research", "none");
    expect(await api.commands.projects.get(project.id)).toMatchObject({ name: "Renamed research", integrationMode: "none", targetBranch: "" });
    const saved = await api.commands.projects.get(project.id);
    for (const mode of ["github_pr", "local_merge"]) {
      await expect(edit("Must not persist", mode)).rejects.toThrow(/target branch/i);
      expect(await api.commands.projects.get(project.id)).toEqual(saved);
    }
    await expect(edit("", "none")).rejects.toThrow(/name/i);
    await expect(edit("Must not persist", "invalid")).rejects.toThrow(/integration mode/i);
    expect(await api.commands.projects.get(project.id)).toEqual(saved);
    await edit("  Local delivery  ", "local_merge", " preview ");
    expect(await api.commands.projects.get(project.id)).toMatchObject({ name: "Local delivery", integrationMode: "local_merge", targetBranch: "preview" });
    await edit("Research again", "none", "preview");
    expect(await api.commands.projects.get(project.id)).toMatchObject({ integrationMode: "none", targetBranch: "preview" });
  });

  it("persists budget edits, invalidates reviewed activations, and rejects invalid or inactive goals without writes", async () => {
    const { missionControlData, applyMissionControlAction } = await import("./server");
    const core = await import("@senderos/core");
    const data = await missionControlData();
    await core.registerExecutionContext({ id: "budget-context", name: "Budget context" });
    const api = core.createSenderos({ executionContextId: "budget-context" });
    const project = await api.commands.projects.create({ id: "budget-project", name: "Budget project", canonicalPath: "/tmp/budget-fixture", githubOwner: "fixture", githubRepo: "fixture" });
    const goal = await api.commands.goals.create({ projectId: project.id, title: "Budget controls", kind: "research", senderoVersionId: data.senderoGraphs[0]!.version.id });
    const edit = (intent: string, limit: string, id = goal.id) => {
      const form = new FormData(); Object.entries({ intent, limit, goalId: id }).forEach(([key, value]) => form.set(key, value));
      return applyMissionControlAction(form);
    };
    await expect(edit("set-retry-budget", "4")).rejects.toThrow(/Activate/);
    await api.commands.goals.activate(goal.id);
    const before = await missionControlData();
    for (const invalid of ["", "1.5", "-1", "1e2", "NaN", "9007199254740992", "0", "101"]) await expect(edit("set-retry-budget", invalid)).rejects.toThrow();
    await expect(edit("set-activation-budget", "10001")).rejects.toThrow();
    await expect(edit("set-retry-budget", "4", "")).rejects.toThrow(/Choose/);
    await expect(edit("set-retry-budget", "4", "missing")).rejects.toThrow();
    expect((await missionControlData()).executions.find(item => item.goalId === goal.id)).toEqual(before.executions.find(item => item.goalId === goal.id));
    await edit("set-activation-budget", "200");
    await edit("set-retry-budget", "4");
    const saved = await missionControlData();
    expect(saved.executions.find(item => item.goalId === goal.id)).toMatchObject({ maxActivations: 200, maxAttempts: 4 });
    const activation = saved.activations.find(item => item.goalId === goal.id)!;
    expect(activation.maxAttempts).toBe(4);
    expect(activation.revision).toBeGreaterThan(before.activations.find(item => item.id === activation.id)!.revision);
    expect(saved.runs.filter(item => item.goalId === goal.id)).toHaveLength(0);
    await api.commands.goals.cancel(goal.id);
    await expect(edit("set-activation-budget", "300")).rejects.toThrow(/terminal/);
    await expect(edit("set-retry-budget", "5")).rejects.toThrow(/terminal/);
    expect((await missionControlData()).executions.find(item => item.goalId === goal.id)).toMatchObject({ maxActivations: 200, maxAttempts: 4 });
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
    expect(data.goals.find(item => item.id === goal.id)?.status).toBe("active");
    expect(data.runs.filter(run => run.goalId === goal.id)).toHaveLength(0);
    const { reviewDispatch } = await import("./dispatch-review");
    const reviewed = data.queue.dispatchable.filter(item => item.goalId === goal.id).map(reviewDispatch);
    expect(reviewed).toHaveLength(1);
    plan.set("scope", JSON.stringify({ projectId: project.id }));
    plan.set("reviewedItems", JSON.stringify(reviewed));
    await applyMissionControlAction(plan, { projectId: project.id });
    data = await missionControlData();
    const run = data.runs.find(run => run.goalId === goal.id)!;
    const attempt = data.attempts.find(attempt => attempt.runId === run.id)!;
    expect(attempt).toMatchObject({ status: "queued", externalSessionId: null, startedAt: null, ownerId: null });

    const evidence = new FormData(); Object.entries({ intent: "evidence", attemptId: attempt.id, label: "Proof", url: "https://example.test/proof" }).forEach(([key, value]) => evidence.set(key, value)); await applyMissionControlAction(evidence);
    const review = new FormData(); Object.entries({ intent: "review", attemptId: attempt.id, status: "approved", rationale: "Looks good" }).forEach(([key, value]) => review.set(key, value)); await applyMissionControlAction(review);
    const evidenceWithoutUrl = new FormData(); Object.entries({ intent: "evidence", attemptId: attempt.id, label: "Local proof", url: "" }).forEach(([key, value]) => evidenceWithoutUrl.set(key, value)); await applyMissionControlAction(evidenceWithoutUrl);
    const submitEvidence = (values: Record<string, string>) => {
      const form = new FormData();
      Object.entries({ intent: "evidence", attemptId: attempt.id, label: "Typed proof", ...values }).forEach(([key, value]) => form.set(key, value));
      return applyMissionControlAction(form);
    };
    for (const kind of ["test", "ci", "pull_request", "artifact", "manual"]) {
      const form = new FormData();
      Object.entries({ intent: "evidence", attemptId: attempt.id, label: "Typed proof", kind, summary: `Recorded ${kind} result` }).forEach(([key, value]) => form.set(key, value));
      const { action } = await import("../../routes/home");
      const url = new URL("http://localhost/canvas");
      const feedback = await action({ request: new Request(url, { method: "POST", body: form }), url, pattern: "/canvas", params: {}, context: new RouterContextProvider() });
      expect(feedback).toMatchObject({ ok: true, intent: "evidence", message: "Evidence recorded. Completion follows the workflow's evidence, review and host requirements." });
      const saved = (await missionControlData()).attempts.find(item => item.id === attempt.id)!;
      expect(JSON.parse(saved.statusSnapshotJson).evidence.at(-1)).toMatchObject({ kind, summary: `Recorded ${kind} result` });
    }
    const beforeInvalidEvidence = await missionControlData();
    await expect(submitEvidence({ kind: "unknown" })).rejects.toThrow(/evidence kind/i);
    const afterInvalidEvidence = await missionControlData();
    expect(afterInvalidEvidence.attempts).toEqual(beforeInvalidEvidence.attempts);
    expect(afterInvalidEvidence.events).toEqual(beforeInvalidEvidence.events);
    const legacyEvidence = JSON.parse(afterInvalidEvidence.attempts.find(item => item.id === attempt.id)!.statusSnapshotJson).evidence;
    expect(legacyEvidence.slice(0, 2).map((item: { kind: string }) => item.kind)).toEqual(["manual", "manual"]);
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
    expect(await homeRoute.action({ request: new Request(routeUrl, { method: "POST", body: noOp }), url: routeUrl, pattern: "/", params: {}, context: routeContext })).toMatchObject({ ok: false, message: expect.stringContaining("not supported") });
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
