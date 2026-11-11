type Invoke = <T>(args: string[]) => T;
type Attempt = { id: string; status: string; recoveryOutcome: string | null; externalSessionId: string | null; resultJson: string; failureSummary: string | null };
type Reservation = { runId: string; attemptId: string; activationId: string };
function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Installed recovery: ${message}`);
}

/** Fresh installed-binary processes only; synthetic observations never launch workers. */
export function checkInstalledRecovery(invoke: Invoke, reject: (args: string[], code: string) => void, fixture: { projectId: string; versionId: string; directory: string }) {
  const read = (id: string) => invoke<Attempt>(['attempt', 'show', id]);
  const reserve = (goalId: string, request: string) => {
    const ready = invoke<Array<{ goalId: string; activationId: string; revision: number }>>(['plan']).filter(item => item.goalId === goalId);
    check(ready.length === 1, 'fixture must have exactly one ready activation');
    return invoke<Reservation>(['run', 'dispatch', '--goal-id', goalId, '--activation-id', ready[0]!.activationId, '--expected-revision', String(ready[0]!.revision), '--request-id', request]);
  };
  const create = (id: string) => {
    invoke(['goal', 'create', '--id', id, '--project-id', fixture.projectId, '--title', 'Offline recovery contract', '--sendero-version-id', fixture.versionId]);
    invoke(['goal', 'activate', id]);
    return reserve(id, id);
  };
  const start = (attemptId: string, session: string) => {
    const { token } = invoke<{ token: string }>(['attempt', 'claim', attemptId, '--owner-id', 'package-host']);
    invoke(['attempt', 'start', attemptId, '--token', token, '--external-session-id', session, '--parent-session-id', 'fixture-controller', '--working-path', fixture.directory]);
    return token;
  };
  const reconcile = (id: string, token: string, outcome: string, extras: string[] = []) => invoke<{ status: string; nextAction: string }>(['attempt', 'reconcile', id, '--owner-id', 'package-host', '--token', token, '--outcome', outcome, '--details', 'Synthetic durable registry observation; no real worker', ...extras]);
  const recover = create('package-recovery-goal');
  const token = start(recover.attemptId, 'fixture-recovery-worker');
  const beforeResume = JSON.stringify(read(recover.attemptId));
  const resume = invoke<unknown>(['attempt', 'resume', recover.attemptId]);
  check(!JSON.stringify(resume).includes(token), 'resume must not expose the ownership token');
  check(JSON.stringify(read(recover.attemptId)) === beforeResume, 'resume must not mutate persisted execution');
  reject(['attempt', 'reconcile', recover.attemptId, '--owner-id', 'package-host', '--outcome', 'unknown', '--details', 'Synthetic observation without live ownership'], 'ALREADY_CLAIMED');
  check(reconcile(recover.attemptId, token, 'unknown').nextAction.includes('Keep blocked'), 'unknown session guidance must keep work blocked');
  check(read(recover.attemptId).status === 'running' && read(recover.attemptId).recoveryOutcome === 'unknown', 'unknown must persist without inventing termination');
  reject(['attempt', 'claim', recover.attemptId, '--owner-id', 'package-host'], 'ALREADY_CLAIMED');
  const beforeConflict = JSON.stringify(read(recover.attemptId));
  reject(['attempt', 'reconcile', recover.attemptId, '--owner-id', 'package-host', '--token', token, '--outcome', 'active', '--details', 'Synthetic wrong session', '--external-session-id', 'wrong-session'], 'SESSION_CONFLICT');
  check(JSON.stringify(read(recover.attemptId)) === beforeConflict, 'rejected session inspection must preserve recovery facts');
  reconcile(recover.attemptId, token, 'active', ['--external-session-id', 'fixture-recovery-worker']);
  check(read(recover.attemptId).recoveryOutcome === 'active', 'active observation must persist across processes');
  const finishedArgs = ['--external-session-id', 'fixture-recovery-worker', '--status', 'failed', '--result-json', '{"reason":"Synthetic recovered failure"}'];
  check(reconcile(recover.attemptId, token, 'finished', finishedArgs).status === 'failed', 'finished observation must settle its recovered result');
  const finished = JSON.stringify(read(recover.attemptId));
  reconcile(recover.attemptId, token, 'finished', finishedArgs);
  check(JSON.stringify(read(recover.attemptId)) === finished, 'finished replay must be idempotent');
  reject(['attempt', 'reconcile', recover.attemptId, '--owner-id', 'package-host', '--outcome', 'finished', '--details', 'Synthetic conflicting recovered result', '--external-session-id', 'fixture-recovery-worker', '--status', 'failed', '--result-json', '{"reason":"Conflicting result"}'], 'RESULT_CONFLICT');
  reject(['attempt', 'update', recover.attemptId, '--token', token, '--status', 'failed'], 'STALE_OWNER');
  check(read(recover.attemptId).recoveryOutcome === 'finished' && JSON.parse(read(recover.attemptId).resultJson).reason === 'Synthetic recovered failure', 'recovered result and observation must remain durable');

  const missing = reserve('package-recovery-goal', 'package-recovery-missing');
  const missingToken = start(missing.attemptId, 'fixture-missing-worker');
  reconcile(missing.attemptId, missingToken, 'missing');
  const beforeAbandon = JSON.stringify(read(missing.attemptId));
  reject(['attempt', 'abandon', missing.attemptId, '--reason', 'Synthetic stopped session'], 'STOP_CONFIRMATION_REQUIRED');
  check(JSON.stringify(read(missing.attemptId)) === beforeAbandon, 'unconfirmed abandonment must preserve execution');
  invoke(['attempt', 'abandon', missing.attemptId, '--confirmed-stopped', '--reason', 'Synthetic registry independently confirms termination']);
  check(read(missing.attemptId).status === 'failed' && read(missing.attemptId).recoveryOutcome === 'missing', 'confirmed abandonment must retain missing-session facts');
  reject(['attempt', 'update', missing.attemptId, '--token', missingToken, '--status', 'failed'], 'STALE_OWNER');

  const canceled = create('package-cancellation-goal');
  const cancelToken = start(canceled.attemptId, 'fixture-canceled-worker');
  invoke(['host', 'grant', 'package-host', '--project-id', fixture.projectId, '--workspace-ref', 'fixture:installed-lifecycle', '--revoke']);
  const cancel = () => invoke<{ status: string }>(['goal', 'cancel', 'package-cancellation-goal']);
  check(cancel().status === 'blocked' && read(canceled.attemptId).status === 'running', 'cancellation request must wait for owned worker acknowledgment');
  check(cancel().status === 'blocked', 'replayed cancellation must still wait for acknowledgment');
  check(invoke<{ cancellationRequested: boolean }>(['attempt', 'heartbeat', canceled.attemptId, '--token', cancelToken]).cancellationRequested, 'revoked grant must let the existing owner receive cancellation');
  invoke(['attempt', 'update', canceled.attemptId, '--token', cancelToken, '--status', 'canceled']);
  check(read(canceled.attemptId).status === 'canceled' && invoke<{ status: string }>(['goal', 'show', 'package-cancellation-goal']).status === 'canceled', 'owner acknowledgment must durably settle cancellation');
  check(cancel().status === 'canceled', 'settled cancellation replay must remain terminal');

  const queued = create('package-queued-cancellation-goal');
  const beforeRevokedClaim = JSON.stringify(read(queued.attemptId));
  reject(['attempt', 'claim', queued.attemptId, '--owner-id', 'package-host'], 'WORKSPACE_NOT_GRANTED');
  check(JSON.stringify(read(queued.attemptId)) === beforeRevokedClaim, 'revoked access must reject new ownership without changing queued work');
  invoke(['goal', 'cancel', 'package-queued-cancellation-goal']);
  check(read(queued.attemptId).status === 'canceled', 'unclaimed queued work must cancel without a host acknowledgment');
  check(invoke<{ status: string }>(['goal', 'show', 'package-queued-cancellation-goal']).status === 'canceled', 'queued cancellation must persist');
  check(!invoke<Array<{ goalId: string }>>(['plan']).some(item => ['package-cancellation-goal', 'package-queued-cancellation-goal'].includes(item.goalId)), 'canceled goals must never return to the dispatch plan');
  check(JSON.stringify(read(recover.attemptId)) === finished, 'later recovery and cancellation must retain the original recovered failure');
  return { finished: 1, abandoned: 1, cancellationAcknowledged: 1, queuedCancellation: 1, leaseExpiryTested: false };
}
