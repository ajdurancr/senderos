import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { checkInstalledRecovery } from './check-installed-recovery';

type Invoke = <T>(args: string[]) => T;
type Attempt = { id: string; runId: string; status: string; attemptNumber: number; retryFromAttemptId: string | null; failureSummary: string | null; externalSessionId: string | null; statusSnapshotJson: string };
type Claim = { token: string; packet: { schemaVersion: number; agent: { id: string; instructions: string }; previous: { attemptId: string } | null } };
type Reservation = { runId: string; attemptId: string; activationId: string };
type Ready = { goalId: string; activationId: string; revision: number };
function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Installed lifecycle: ${message}`);
}

/** Execute only the installed binary, once per command; no Core/source imports. */
export function checkInstalledLifecycle(invoke: Invoke, reject: (args: string[], message: string) => void, directory: string, expireLease: (attemptId: string) => void) {
  const project = invoke<{ id: string }>(['project', 'create', '--name', 'Installed lifecycle fixture', '--integration-mode', 'none']);
  const agent = invoke<{ id: string }>(['agent', 'create', '--slug', 'package-worker', '--name', 'Package worker', '--instructions', 'Synthetic offline contract only; do not launch any tools or model.']);
  const definitionPath = join(directory, 'installed-workflow.json');
  writeFileSync(definitionPath, JSON.stringify({
    slug: 'package-lifecycle', name: 'Installed lifecycle fixture',
    nodes: [
      { key: 'start', kind: 'start', label: 'Start' },
      { key: 'work', kind: 'agent', label: 'Fixture work', agentSlug: 'package-worker', executionObjective: 'Report synthetic fixture evidence.', requirements: ['independent_session'], completion: { requireReview: true, evidenceKinds: ['test'] } },
      { key: 'end', kind: 'end', label: 'End' },
    ],
    edges: [{ source: 'start', target: 'work' }, { source: 'work', target: 'end', condition: { outcome: 'accepted' } }],
  }));
  const draft = invoke<{ sendero: { id: string }; version: { id: string; status: string } }>(['sendero', 'import', '--file', definitionPath]);
  check(draft.version.status === 'draft', 'import must produce a draft');
  const published = invoke<typeof draft>(['sendero', 'publish', draft.sendero.id]);
  check(published.version.status === 'published', 'publication must persist');
  invoke(['agent', 'update', agent.id, '--instructions', 'Edited after publication; must not replace pinned instructions.']);
  const goal = invoke<{ id: string; status: string }>(['goal', 'create', '--id', 'package-lifecycle-goal', '--project-id', project.id, '--title', 'Offline package contract', '--sendero-version-id', published.version.id]);
  check(goal.status === 'draft', 'goal must start as a draft');
  invoke(['goal', 'activate', goal.id]);
  const plan = () => invoke<Ready[]>(['plan']).filter(item => item.goalId === goal.id);
  const ready = plan();
  check(ready.length === 1, 'activation must expose one ready step');
  const dispatchArgs = ['run', 'dispatch', '--goal-id', goal.id, '--activation-id', ready[0]!.activationId, '--expected-revision', String(ready[0]!.revision), '--request-id', 'package-first'];
  const first = invoke<Reservation>(dispatchArgs);
  const again = invoke<Reservation>(dispatchArgs);
  check(first.attemptId === again.attemptId && first.runId === again.runId, 'dispatch replay must preserve reservation identity');
  const attempts = () => invoke<Attempt[]>(['attempt', 'list']);
  check(attempts().length === 1 && attempts()[0]!.status === 'queued', 'dispatch must reserve without starting');
  invoke(['host', 'register', 'package-host', '--name', 'Synthetic package host', '--harness', 'codex', '--capability', 'independent_session']);
  const beforeDenied = JSON.stringify(attempts());
  reject(['attempt', 'claim', first.attemptId, '--owner-id', 'package-host'], 'WORKSPACE_NOT_GRANTED');
  check(JSON.stringify(attempts()) === beforeDenied, 'claim without workspace grant must not change attempts');
  invoke(['host', 'grant', 'package-host', '--project-id', project.id, '--workspace-ref', 'fixture:installed-lifecycle']);
  reject(['attempt', 'claim', first.attemptId, '--owner-id', 'package-host'], 'PREFLIGHT_FAILED');
  check(JSON.stringify(attempts()) === beforeDenied, 'unavailable workspace must not change attempts');
  invoke(['host', 'workspace', 'package-host', '--project-id', project.id, '--available', '--working-path', directory]);
  check(invoke<{ eligible: boolean }>(['attempt', 'preflight', first.attemptId, '--owner-id', 'package-host']).eligible, 'granted fixture workspace must pass preflight');
  const claim = (id: string) => invoke<Claim>(['attempt', 'claim', id, '--owner-id', 'package-host']);
  const start = (id: string, token: string, session: string) => invoke(['attempt', 'start', id, '--token', token, '--external-session-id', session, '--parent-session-id', 'fixture-controller', '--working-path', directory]);
  const owned = claim(first.attemptId);
  check(typeof owned.token === 'string' && owned.token.length > 0, 'claim must issue an isolated fixture token');
  check(owned.packet.schemaVersion === 2 && owned.packet.agent.id === agent.id && owned.packet.agent.instructions === 'Synthetic offline contract only; do not launch any tools or model.', 'installed packet must retain the publication-pinned agent');
  const claimed = JSON.stringify(attempts());
  reject(['attempt', 'update', first.attemptId, '--token', 'invalid-fixture-token', '--status', 'succeeded'], 'STALE_OWNER');
  check(JSON.stringify(attempts()) === claimed, 'invalid ownership must not change attempt state');
  start(first.attemptId, owned.token, 'fixture-worker-first');
  invoke(['attempt', 'update', first.attemptId, '--token', owned.token, '--status', 'failed', '--failure-summary', 'Synthetic failure retained across package processes']);
  const retryReady = plan();
  check(retryReady.length === 1 && retryReady[0]!.activationId === first.activationId, 'failure must make the same activation retryable');
  const retry = invoke<Reservation>(['run', 'dispatch', '--goal-id', goal.id, '--activation-id', retryReady[0]!.activationId, '--expected-revision', String(retryReady[0]!.revision), '--request-id', 'package-retry']);
  const retried = invoke<Attempt>(['attempt', 'show', retry.attemptId]);
  check(retry.runId !== first.runId && retried.retryFromAttemptId === first.attemptId && retried.attemptNumber === 2, 'retry must preserve exact lineage in a new run');
  const retryOwner = claim(retry.attemptId);
  check(retryOwner.packet.previous?.attemptId === first.attemptId, 'retry packet must identify its exact predecessor');
  start(retry.attemptId, retryOwner.token, 'fixture-worker-retry');
  invoke(['attempt', 'heartbeat', retry.attemptId, '--token', retryOwner.token]);
  invoke(['attempt', 'update', retry.attemptId, '--token', retryOwner.token, '--status', 'succeeded', '--result-json', '{"outcome":"accepted","summary":"Synthetic fixture result"}']);
  const read = () => invoke<Attempt>(['attempt', 'show', retry.attemptId]);
  check(read().status === 'paused', 'reported success must wait for evidence and review');
  invoke(['attempt', 'evidence', retry.attemptId, '--token', retryOwner.token, '--kind', 'manual', '--label', 'Synthetic observation']);
  invoke(['attempt', 'review', retry.attemptId, '--status', 'approved', '--reviewer', 'Package fixture', '--rationale', 'Synthetic contract only']);
  check(read().status === 'paused', 'manual evidence and approval must not satisfy the test gate');
  invoke(['attempt', 'evidence', retry.attemptId, '--token', retryOwner.token, '--kind', 'test', '--label', 'Synthetic test proof']);
  check(read().status === 'succeeded', 'qualifying evidence must settle the completion gate');
  const finalGoal = invoke<{ status: string }>(['goal', 'show', goal.id]);
  check(finalGoal.status === 'completed' && plan().length === 0, 'goal must explicitly complete, with no remaining dispatch');
  const original = invoke<Attempt>(['attempt', 'show', first.attemptId]);
  check(original.status === 'failed' && original.failureSummary === 'Synthetic failure retained across package processes', 'retry must retain original failure facts');
  check(attempts().length === 2 && invoke<unknown[]>(['run', 'list']).length === 2, 'replay and rejected operations must not add runs or attempts');
  check(invoke<{ id: string }>(['agent', 'show', agent.id]).id === agent.id, 'custom agent must remain readable after process restarts');
  const recovery = checkInstalledRecovery(invoke, reject, { projectId: project.id, versionId: published.version.id, directory, expireLease });
  check(attempts().length === 6 && invoke<unknown[]>(['run', 'list']).length === 6, 'recovery, replay and cancellation must preserve exact reservation counts');
  return { attempts: 6, runs: 6, goal: finalGoal.status, recovery, offline: true, realHostExecution: false };
}
