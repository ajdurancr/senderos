/** Browser tests use core only for prerequisites, read-only DB assertions, and
 * the explicitly simulated external host boundary. All Studio mutations are UI. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { count, eq } from 'drizzle-orm';
import { createSenderos, prepareSharedDatabase, registerExecutionContext } from '@senderos/core';
import { atomic, openRuntimeDb } from '../../../packages/core/src/db/client';
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
    eventCount: (await db.select({ value: count() }).from(schema.events))[0]!.value,
    executionContexts: await db.select().from(schema.executionContexts),
    projects: await db.select().from(schema.projects),
    agents: await db.select().from(schema.agents),
    senderos: await db.select().from(schema.senderos),
    versions: await db.select().from(schema.senderoVersions),
    nodes: await db.select().from(schema.senderoNodes),
    edges: await db.select().from(schema.senderoEdges),
    goals: await db.select().from(schema.goals),
    executions: await db.select().from(schema.goalExecutions),
    activations: await db.select().from(schema.activations),
    runs: await db.select().from(schema.runs),
    attempts: await db.select().from(schema.runAttempts),
    // Tokens remain in the private test runtime, never in reports or hydration.
    claims: (await db.select().from(schema.attemptClaims)).map(({ token: _token, ...claim }) => claim),
  }; } finally { db.$client.close(); }
}

let result: unknown;
if (command === 'hold-read-lock') {
  const db = openRuntimeDb();
  try {
    await db.$client.execute('BEGIN EXCLUSIVE');
    console.log('isolated-read-lock-acquired');
    await Bun.sleep(500);
    await db.$client.executeMultiple('COMMIT');
  } finally { db.$client.close(); }
  process.exit(0);
} else if (command === 'init') {
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
} else if (command === 'prepare-draft-goal' && id) {
  const product = createSenderos({ executionContextId: `product-${id}` });
  result = await product.commands.goals.create({ projectId: `campaign-${id}`, title: `Unassigned draft ${id}`, senderoVersionId: null });
} else if (command === 'prepare-evidence-references' && id) {
  // Retained imported proof is synthetic history, never an external file read.
  const product = createSenderos({ executionContextId: `product-${id}` });
  const goal = await product.commands.goals.create({ projectId: `launch-${id}`, title: `Retained artifact references ${id}`, senderoVersionId: null });
  await product.commands.goals.cancel(goal.id);
  const db = openRuntimeDb();
  try {
    const agent = (await db.select().from(schema.agents))[0]!;
    const runId = `evidence-run-${id}`, attemptId = `evidence-attempt-${id}`;
    const timestamp = '2000-01-01T00:00:00.000Z';
    await db.insert(schema.runs).values({ id: runId, goalId: goal.id, status: 'canceled', createdAt: timestamp, updatedAt: timestamp });
    const references = ['file:///isolated/artifacts/desktop%20acceptance.png', '/isolated/artifacts/mobile acceptance report.txt', 'artifact:retained-verification-123'];
    await db.insert(schema.runAttempts).values({ id: attemptId, runId, attemptNumber: 1, agentId: agent.id, status: 'canceled', executionObjective: 'Inspect retained artifact proof', harness: 'history-fixture', finishedAt: timestamp, createdAt: timestamp, updatedAt: timestamp, statusSnapshotJson: JSON.stringify({ evidence: references.map((url, i) => ({ id: `reference-${i}`, label: `Retained artifact ${i + 1}`, kind: 'artifact', url, summary: 'Synthetic imported artifact reference.', createdAt: timestamp })) }) });
    result = { goalId: goal.id, attemptId, references };
  } finally { db.$client.close(); }
} else if (command === 'prepare-tied-run-history' && id) {
  // Synthetic settled records isolate timestamp-tie inspection; no host is invoked.
  const product = createSenderos({ executionContextId: `product-${id}` });
  const goal = await product.commands.goals.create({ projectId: `launch-${id}`, title: `Tied run inspection ${id}`, senderoVersionId: null });
  await product.commands.goals.cancel(goal.id);
  const db = openRuntimeDb(), agent = (await db.select().from(schema.agents))[0]!;
  const timestamp = '2000-01-01T00:00:00.000Z';
  const records = ['z', 'a'].map(suffix => ({ id: `tied-run-${id}-${suffix}`, goalId: goal.id, status: 'canceled', createdAt: timestamp, updatedAt: timestamp }));
  await db.insert(schema.runs).values(records);
  await db.insert(schema.runAttempts).values(records.flatMap(run => [2, 1].map(attemptNumber => ({ id: `${run.id}-attempt-${attemptNumber}`, runId: run.id, attemptNumber, agentId: agent.id, status: 'canceled', executionObjective: `${run.id.endsWith('-z') ? 'Latest' : 'Earlier'} retained objective ${attemptNumber}`, harness: 'history-fixture', finishedAt: timestamp, createdAt: timestamp, updatedAt: timestamp }))));
  result = { goalId: goal.id, latestAttemptId: `${records[0]!.id}-attempt-2`, olderAttemptId: `${records[1]!.id}-attempt-1` };
} else if (command === 'prepare-run-history' && id) {
  // Synthetic terminal history tests browsing scale, never real host execution.
  const product = createSenderos({ executionContextId: `product-${id}` });
  const goal = await product.commands.goals.create({ projectId: `launch-${id}`, title: `Archived executions ${id}`, senderoVersionId: null });
  await product.commands.goals.cancel(goal.id);
  const db = openRuntimeDb();
  const agent = (await db.select().from(schema.agents))[0]!;
  const timestamp = new Date(Date.now() + 60_000).toISOString();
  const records = Array.from({ length: 125 }, (_, i) => ({ id: `run-history-${id}-${String(i).padStart(3, '0')}`, goalId: goal.id, status: 'canceled', createdAt: timestamp, updatedAt: timestamp }));
  await db.insert(schema.runs).values(records);
  await db.insert(schema.runAttempts).values(records.map((run, i) => ({ id: `attempt-history-${id}-${String(i).padStart(3, '0')}`, runId: run.id, attemptNumber: 1, agentId: agent.id, status: 'canceled', executionObjective: `Archived fixture ${i}`, harness: 'history-fixture', statusSnapshotJson: JSON.stringify({ evidence: [{ id: `history-proof-${i}`, kind: 'artifact', label: `Archived proof ${i}`, createdAt: timestamp }] }), finishedAt: timestamp, createdAt: timestamp, updatedAt: timestamp })));
  result = { inserted: records.length, goalId: goal.id };
} else if (command === 'prepare-activation-history' && id) {
  // Synthetic settled graph visits exercise presentation only; no real execution is claimed.
  const db = openRuntimeDb();
  const original = (await db.select().from(schema.activations).where(eq(schema.activations.goalId, id)))[0];
  if (!original) throw new Error('Missing real activation prerequisite');
  const timestamp = new Date(Date.now() - 60_000).toISOString();
  const history = Array.from({ length: 125 }, (_, i) => ({ ...original, id: `visit-history-${id}-${String(i).padStart(3, '0')}`, parentActivationId: i ? `visit-history-${id}-${String(i - 1).padStart(3, '0')}` : null, latestRunId: `visit-run-${id}-${i}`, previousRunId: i ? `visit-run-${id}-${i - 1}` : null, status: 'canceled', reason: null, revision: 1, scopesJson: '["fixture-fork-generation"]', createdAt: timestamp, updatedAt: timestamp }));
  await db.insert(schema.activations).values(history);
  await db.insert(schema.runs).values(history.map(row => ({ id: row.latestRunId, activationId: row.id, goalId: id, status: 'canceled', createdAt: timestamp, updatedAt: timestamp })));
  const attempt = (await db.select().from(schema.runAttempts).where(eq(schema.runAttempts.runId, original.latestRunId!)))[0]!;
  await db.insert(schema.runAttempts).values(history.map((row, i) => ({ id: `visit-attempt-${id}-${i}`, runId: row.latestRunId, attemptNumber: 1, agentId: attempt.agentId, harness: 'history-fixture', status: 'canceled', executionObjective: `Archived visit ${i}`, statusSnapshotJson: JSON.stringify({ evidence: [{ id: `visit-proof-${i}`, kind: 'artifact', label: `Visit proof ${i}`, createdAt: timestamp }] }), finishedAt: timestamp, createdAt: timestamp, updatedAt: timestamp })));
  result = { inserted: history.length };
} else if (command === 'prepare-history' && id) {
  // Synthetic observations are fixture data, never operator mutations.
  const db = openRuntimeDb();
  const goal = (await db.select().from(schema.goals).where(eq(schema.goals.title, `History recovery ${id}`)))[0];
  if (!goal) throw new Error('Missing history goal prerequisite');
  const createdAt = new Date(Date.now() + 60_000).toISOString();
  await db.insert(schema.events).values(Array.from({ length: 125 }, (_, i) => ({ id: `history-${id}-${String(i).padStart(3, '0')}`, eventType: 'fixture.history', entityType: i < 105 ? 'goal' : 'project', entityId: i < 105 ? goal.id : `campaign-${id}`, createdAt, payloadJson: JSON.stringify({ observation: `Fixture recorded event ${i}`, detail: 'x'.repeat(240) }) })));
  result = { inserted: 125 };
} else if (command === 'remove-fixture-cursor' && id) {
  // Explicit partial-state recovery fixture. Operator actions remain browser forms.
  result = await atomic(undefined, async () => {
    const db = openRuntimeDb();
    const retained = await db.select().from(schema.activations).where(eq(schema.activations.goalId, id));
    if (retained.length !== 2) throw new Error('Recovery fixture requires two retained visits');
    await db.delete(schema.activations).where(eq(schema.activations.goalId, id));
    for (const activation of retained.reverse()) await db.insert(schema.activations).values(activation);
    await db.delete(schema.goalExecutions).where(eq(schema.goalExecutions.goalId, id));
    return { removed: true };
  });
} else if (command === 'remove-legacy-policy-fixture-cursor' && id) {
  // Match the supported pre-activation migration shape in the isolated fixture.
  result = await atomic(undefined, async () => {
    const db = openRuntimeDb();
    await db.delete(schema.activations).where(eq(schema.activations.goalId, id));
    await db.delete(schema.goalExecutions).where(eq(schema.goalExecutions.goalId, id));
    await db.update(schema.runs).set({ activationId: null }).where(eq(schema.runs.goalId, id));
    return { removed: true };
  });
} else if (command === 'remove-policy-fixture-cursor' && id) {
  // Isolated partial-state damage only; cancellation uses the real operator form.
  await openRuntimeDb().delete(schema.goalExecutions).where(eq(schema.goalExecutions.goalId, id));
  result = { removed: true };
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
} else if (command === 'expire-fixture-lease' && id) {
  // Explicit clock fixture after a real local claim/start; never an external host call.
  await atomic(undefined, async () => {
    await openRuntimeDb().update(schema.attemptClaims).set({ leaseExpiresAt: '2000-01-01T00:00:00.000Z' }).where(eq(schema.attemptClaims.attemptId, id));
  });
  result = { expired: id };
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
} else if (['host-start', 'host-complete', 'host-test-evidence', 'host-cancel', 'host-fail', 'host-reconcile-unknown', 'host-reconcile-missing', 'host-reconcile-active'].includes(command ?? '') && id) {
  const stored = JSON.parse(readFileSync(join(runtime, `${id}.host.json`), 'utf8')) as { token: string; workingPath: string; context: string };
  const host = createSenderos({ executionContextId: stored.context });
  if (command.startsWith('host-reconcile-')) {
    const outcome = command.replace('host-reconcile-', '') as 'unknown' | 'missing' | 'active';
    result = await host.commands.attempts.reconcile({ attemptId: id, ownerId: `simulated-${id}`, token: stored.token, outcome, details: `Deterministic fixture inspection: ${outcome}`, externalSessionId: `simulated-worker-${id}` });
  }
  if (command === 'host-start') result = await host.commands.attempts.start({ attemptId: id, token: stored.token, externalSessionId: `simulated-worker-${id}`, parentSessionId: 'simulated-e2e-controller', workingPath: stored.workingPath });
  if (command === 'host-complete') result = await host.commands.attempts.update(id, { token: stored.token, status: 'succeeded', result: { outcome: 'accepted', summary: 'Deterministic external execution fixture finished.' } });
  if (command === 'host-test-evidence') result = await host.commands.attempts.recordEvidence({ attemptId: id, token: stored.token, kind: 'test', label: 'Host test report', url: 'https://example.com/e2e/host-tests' });
  if (command === 'host-fail') result = await host.commands.attempts.update(id, { token: stored.token, status: 'failed', failureSummary: 'Deterministic failed worker fixture' });
  if (command === 'host-cancel') result = await host.commands.attempts.update(id, { token: stored.token, status: 'canceled' });
} else throw new Error(`Unknown test runtime command: ${command}`);
console.log(JSON.stringify(result));
