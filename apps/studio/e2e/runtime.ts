/** Browser tests use core only for prerequisites, read-only DB assertions, and
 * the explicitly simulated external host boundary. All Studio mutations are UI. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createSenderos, prepareSharedDatabase, registerExecutionContext } from '@senderos/core';
import { openRuntimeDb } from '../../../packages/core/src/db/client';
import * as schema from '../../../packages/core/src/db/schema';

const runtime = process.env.STUDIO_E2E_RUNTIME;
if (!runtime || !resolve(runtime).includes('/.tmp/test-runtime/studio-e2e-')) {
  throw new Error('Refusing to operate outside an isolated Studio E2E runtime');
}
process.env.SENDEROS_DATABASE_URL = `file:${join(runtime, 'senderos.db')}`;
delete process.env.SENDEROS_DATABASE_AUTH_TOKEN;
const [command, id] = process.argv.slice(2);
const all = createSenderos({ allExecutionContexts: true });

async function snapshot() {
  const db = openRuntimeDb();
  try { return {
    projects: await db.select().from(schema.projects),
    agents: await db.select().from(schema.agents),
    senderos: await db.select().from(schema.senderos),
    versions: await db.select().from(schema.senderoVersions),
    nodes: await db.select().from(schema.senderoNodes),
    edges: await db.select().from(schema.senderoEdges),
    goals: await db.select().from(schema.goals),
    activations: await db.select().from(schema.activations),
    runs: await db.select().from(schema.runs),
    attempts: await db.select().from(schema.runAttempts),
    // Tokens remain in the private test runtime, never in reports or hydration.
    claims: (await db.select().from(schema.attemptClaims)).map(({ token: _token, ...claim }) => claim),
  }; } finally { db.$client.close(); }
}

let result: unknown;
if (command === 'init') {
  mkdirSync(runtime, { recursive: true });
  await prepareSharedDatabase();
  result = { initialized: true };
} else if (command === 'prepare-test' && id) {
  const productContext = `product-${id}`, researchContext = `research-${id}`;
  const launchProject = `launch-${id}`, campaignProject = `campaign-${id}`, researchProject = `research-project-${id}`;
  await registerExecutionContext({ id: productContext, name: `Product team ${id.slice(0, 8)}` });
  await registerExecutionContext({ id: researchContext, name: `Research team ${id.slice(0, 8)}` });
  const product = createSenderos({ executionContextId: productContext });
  await product.commands.projects.create({ id: launchProject, name: 'Website launch', canonicalPath: join(runtime, 'launch', id), githubOwner: 'example', githubRepo: 'launch-site', targetBranch: 'main', integrationMode: 'github_pr' });
  await product.commands.projects.create({ id: campaignProject, name: 'Next campaign' });
  const research = createSenderos({ executionContextId: researchContext });
  await research.commands.projects.create({ id: researchProject, name: 'Research project' });
  const prerequisite = await all.commands.senderos.get('sendero-software-delivery');
  if (!prerequisite || prerequisite.version.status !== 'published') throw new Error('Missing built-in published prerequisite');
  result = { id, productContext, researchContext, launchProject, campaignProject, researchProject, prerequisiteVersionId: prerequisite.version.id };
} else if (command === 'snapshot') {
  // Browser navigation can still be finishing its real planning transaction.
  // Retry reads only; never repeat a host command or an operator mutation.
  const deadline = Date.now() + 5000;
  for (;;) {
    try { result = await snapshot(); break; }
    catch (error) {
      let cause: unknown = error;
      let busy = false;
      while (cause instanceof Error) {
        if (/SQLITE_BUSY|database is locked/.test(cause.message)) busy = true;
        cause = cause.cause;
      }
      if (!busy || Date.now() >= deadline) throw error;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
} else if (command === 'host-claim' && id) {
  const attempt = await all.commands.attempts.get(id);
  if (!attempt) throw new Error('Missing attempt');
  const run = await all.commands.runs.get(attempt.runId);
  const goal = await all.commands.goals.get(run!.goalId);
  const project = await all.commands.projects.get(goal!.projectId);
  const host = createSenderos({ executionContextId: project!.executionContextId });
  const hostId = `simulated-${id}`;
  const workingPath = join(runtime, 'mock-execution', id);
  mkdirSync(workingPath, { recursive: true });
  await host.commands.hosts.register({ id: hostId, name: 'Deterministic E2E host', harness: 'simulated-browser-worker', capabilities: ['independent_session', 'browser', 'shell'] });
  await all.commands.hosts.grant({ hostId, projectId: project!.id, workspaceRef: 'fixture:browser-acceptance' });
  await host.commands.hosts.workspace({ hostId, projectId: project!.id, available: true, workingPath });
  const preflight = await host.commands.hosts.preflight({ attemptId: id, ownerId: hostId });
  if (!preflight.eligible) throw new Error(`Host is ineligible: ${JSON.stringify(preflight)}`);
  const claim = await host.commands.attempts.claim({ attemptId: id, ownerId: hostId, leaseSeconds: 600 });
  writeFileSync(join(runtime, `${id}.host.json`), JSON.stringify({ token: claim.token, workingPath, context: project!.executionContextId }), { mode: 0o600 });
  result = { eligible: preflight.eligible, claimed: claim.claimed, started: claim.started };
} else if (['host-start', 'host-complete', 'host-test-evidence', 'host-cancel'].includes(command ?? '') && id) {
  const stored = JSON.parse(readFileSync(join(runtime, `${id}.host.json`), 'utf8')) as { token: string; workingPath: string; context: string };
  const host = createSenderos({ executionContextId: stored.context });
  if (command === 'host-start') result = await host.commands.attempts.start({ attemptId: id, token: stored.token, externalSessionId: `simulated-worker-${id}`, parentSessionId: 'simulated-e2e-controller', workingPath: stored.workingPath });
  if (command === 'host-complete') result = await host.commands.attempts.update(id, { token: stored.token, status: 'succeeded', result: { outcome: 'accepted', summary: 'Deterministic external execution fixture finished.' } });
  if (command === 'host-test-evidence') result = await host.commands.attempts.recordEvidence({ attemptId: id, token: stored.token, kind: 'test', label: 'Host test report', url: 'https://example.com/e2e/host-tests' });
  if (command === 'host-cancel') result = await host.commands.attempts.update(id, { token: stored.token, status: 'canceled' });
} else throw new Error(`Unknown test runtime command: ${command}`);
console.log(JSON.stringify(result));
