import { expect, test } from "bun:test";

import { listSenderoGraphs } from "../mission-control/senderos";
import { initHome } from "../test-support/runtime";
import { seedBuiltInSenderos } from "./seed-senderos";

test("built-in Sendero seeding is idempotent", async () => {
  const home = await initHome();
  await expect(seedBuiltInSenderos(home)).resolves.toHaveLength(5);
  await expect(seedBuiltInSenderos(home)).resolves.toHaveLength(5);
  const graphs = await listSenderoGraphs(home);
  expect(graphs).toHaveLength(5);
  expect(graphs.every(graph => graph.version.protocolVersion === 2)).toBe(true);
  expect(graphs.every((graph) => graph.nodes.length === 7)).toBe(true);
  expect(graphs.every((graph) => graph.edges.length === 6)).toBe(true);
  const demo = graphs.find((graph) => graph.sendero.slug === "timed-wait-demo")!;
  expect(demo.nodes.filter((node) => node.kind === "agent").map((node) => node.label)).toEqual([
    "Wait 1 minute",
    "Wait 2 minutes",
    "Wait 3 minutes",
    "Wait 4 minutes",
    "Wait 5 minutes",
  ]);
});

test('missing template agents roll back initialization instead of leaving partial published graphs', async () => {
  const { eq } = await import('drizzle-orm');
  const { openRuntimeDb } = await import('../db/client');
  const { agents, senderos, senderoVersions, senderoNodes, senderoEdges } = await import('../db/schema');
  const home = await initHome();
  const db = openRuntimeDb(home);
  await db.delete(senderoEdges);
  await db.delete(senderoNodes);
  await db.delete(senderoVersions);
  await db.delete(senderos);
  await db.delete(agents).where(eq(agents.slug, 'dependency-curator'));
  await expect(seedBuiltInSenderos(home)).rejects.toThrow('missing agent: dependency-curator');
  expect(await db.select().from(senderos)).toHaveLength(0);
  expect(await db.select().from(senderoVersions)).toHaveLength(0);
  expect(await db.select().from(senderoNodes)).toHaveLength(0);
  expect(await db.select().from(senderoEdges)).toHaveLength(0);
});

test('initial template publication pins instructions used by later execution packets', async () => {
  const { eq } = await import('drizzle-orm');
  const { openRuntimeDb } = await import('../db/client');
  const { attemptClaims } = await import('../db/schema');
  const { getSenderoGraph } = await import('../commands/senderos/get-graph');
  const { getAgentBySlug } = await import('../commands/agents/get-by-slug');
  const { updateAgent } = await import('../commands/agents/create');
  const { createGoal, activateGoal } = await import('../commands/goals');
  const { dispatchRun } = await import('../commands/runs/dispatch');
  const { createProjectFixture } = await import('../test-support/runtime');
  const { startTestWorker } = await import('../test-support/worker');
  const { updateRunAttempt } = await import('../commands/attempts/update');
  const home = await initHome();
  const project = await createProjectFixture(home);
  const initial = (await getAgentBySlug('spec-partner', home))!;
  const published = (await getSenderoGraph('software-delivery', undefined, home))!;
  const node = published.nodes.find(candidate => candidate.agentId === initial.id)!;
  expect(published.version.protocolVersion).toBe(2);
  expect(JSON.parse(node.agentSnapshotJson!)).toEqual({ id: initial.id, name: initial.name, instructions: initial.definitionBody, requiredCapabilities: [] });
  const goal = await createGoal({ home, projectId: project.id, title: 'Keep the published instructions' });
  await activateGoal(goal.id, home);
  await updateAgent({ home, id: initial.id, name: 'Renamed globally', instructions: 'Changed after the template was published.', defaultMeta: { requiredCapabilities: ['browser'] } });
  const dispatched = await dispatchRun({ goalId: goal.id }, home);
  const claim = (await openRuntimeDb(home).select().from(attemptClaims).where(eq(attemptClaims.attemptId, dispatched.attemptId)))[0]!;
  const packet = JSON.parse(claim.packetJson);
  expect(packet.schemaVersion).toBe(2);
  expect(packet.agent).toEqual({ id: initial.id, name: initial.name, instructions: initial.definitionBody });
  expect(packet.requiredCapabilities).toEqual([]);
  await expect(updateRunAttempt(dispatched.attemptId, { status: 'succeeded' }, home)).rejects.toMatchObject({ code: 'CLAIM_REQUIRED' });
  const worker = await startTestWorker(home, project.id, dispatched.attemptId);
  expect(worker.packet.agent.instructions).toBe(initial.definitionBody);
  expect(await updateRunAttempt(dispatched.attemptId, { status: 'succeeded', token: worker.token }, home)).toMatchObject({ status: 'succeeded' });
});

test('fresh bundled workflows require a claim and a distinct worker session before reporting', async () => {
  const { createProjectFixture } = await import('../test-support/runtime');
  const { createGoal, activateGoal } = await import('../commands/goals');
  const { dispatchRun } = await import('../commands/runs/dispatch');
  const { updateRunAttempt } = await import('../commands/attempts/update');
  const { getRunAttempt } = await import('../commands/attempts/get');
  const { claimAttempt, startAttempt } = await import('../lifecycle/hosts');
  const { registerHost, grantHostWorkspace, declareHostWorkspace } = await import('../lifecycle/host-registry');
  const home = await initHome();
  const project = await createProjectFixture(home);
  const goal = await createGoal({ home, projectId: project.id, title: 'Fresh setup is strict' });
  await activateGoal(goal.id, home);
  const run = await dispatchRun({ goalId: goal.id }, home);
  await expect(updateRunAttempt(run.attemptId, { status: 'succeeded' }, home)).rejects.toMatchObject({ code: 'CLAIM_REQUIRED' });
  await registerHost({ id: 'strict-seed-host', name: 'Seed test host', harness: 'test-harness', capabilities: ['independent_session'] }, home);
  await grantHostWorkspace({ hostId: 'strict-seed-host', projectId: project.id, workspaceRef: project.id }, home);
  await declareHostWorkspace({ hostId: 'strict-seed-host', projectId: project.id, workingPath: '/seed-test/workspace', available: true }, home);
  const claim = await claimAttempt({ attemptId: run.attemptId, ownerId: 'strict-seed-host' }, home);
  expect(claim.started).toBe(false);
  expect(await getRunAttempt(run.attemptId, home)).toMatchObject({ status: 'queued', startedAt: null });
  await expect(updateRunAttempt(run.attemptId, { status: 'succeeded', token: claim.token }, home)).rejects.toMatchObject({ code: 'SESSION_REQUIRED' });
  await expect(startAttempt({ attemptId: run.attemptId, token: claim.token, externalSessionId: 'controller', parentSessionId: 'controller', workingPath: '/seed-test/workspace' }, home)).rejects.toMatchObject({ code: 'INDEPENDENT_SESSION_REQUIRED' });
  const started = await startAttempt({ attemptId: run.attemptId, token: claim.token, externalSessionId: 'independent-worker', parentSessionId: 'controller', workingPath: '/seed-test/workspace' }, home);
  expect(started).toMatchObject({ status: 'running', externalSessionId: 'independent-worker' });
  expect(await updateRunAttempt(run.attemptId, { status: 'succeeded', token: claim.token }, home)).toMatchObject({ status: 'succeeded' });
});
