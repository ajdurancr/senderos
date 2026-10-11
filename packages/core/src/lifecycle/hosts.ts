import { and, eq, ne, notInArray } from 'drizzle-orm';
import { atomic, openRuntimeDb } from '../db/client';
import { attemptClaims, runAttempts, runs } from '../db/schema';
import { now, randomId } from '../shared/ids';
import { emitEvent } from '../shared/events';
import { requireAttempt, requireRun, requireGoal, scopedApi } from './scope';
import { requireLifecycle } from './errors';
import { terminal } from './state';
import { updateRunAttempt } from '../commands/attempts/update';
import { hostPreflight, requireHost } from './host-registry';
import { withAttemptHostAccess } from './host-access';
import { isDeepStrictEqual } from 'node:util';
import { executionHosts } from '../db/host-schema';

export async function verifyOwner(attemptId: string, token: string | undefined, home?: string, allowExpired = false) {
  const claim = (await openRuntimeDb(home).select().from(attemptClaims).where(eq(attemptClaims.attemptId, attemptId)))[0];
  if (claim?.protocolVersion === 2) requireLifecycle(claim.ownerId, 'CLAIM_REQUIRED', 'Claim the attempt before reporting');
  if (claim?.ownerId) {
    requireLifecycle(token && token === claim.token, 'STALE_OWNER', 'Current claim token is required');
    requireLifecycle(allowExpired || (claim.leaseExpiresAt && Date.parse(claim.leaseExpiresAt) > Date.now()), 'LEASE_EXPIRED', 'Lease expired; inspect the session and explicitly reclaim before reporting');
  }
  return claim;
}
function leaseDuration(seconds = 120) {
  requireLifecycle(Number.isInteger(seconds) && seconds >= 10 && seconds <= 3600, 'INVALID_INPUT', 'leaseSeconds must be between 10 and 3600');
  return seconds;
}
export async function claimAttempt(input: { attemptId: string; ownerId: string; leaseSeconds?: number; reclaim?: boolean; token?: string }, home?: string) {
  return atomic(home, async () => {
    requireLifecycle(input.ownerId.trim().length > 0, 'INVALID_INPUT', 'ownerId is required');
    const seconds = leaseDuration(input.leaseSeconds);
    const db = openRuntimeDb(home);
    const current = (await db.select().from(attemptClaims).where(eq(attemptClaims.attemptId, input.attemptId)))[0];
    const strict = current?.protocolVersion === 2;
    const recorded = strict ? (await db.select().from(runAttempts).where(eq(runAttempts.id, input.attemptId)))[0] : undefined;
    if (strict && recorded?.startedAt) {
      // Registry changes affect future launches, never the location/tool of an existing session.
      await requireHost(input.ownerId, home);
      requireLifecycle(current.ownerId === input.ownerId, 'ALREADY_CLAIMED', 'Only the assigned host may renew or recover its existing session');
    }
    const preflight = strict && !recorded?.startedAt ? await hostPreflight(input, home) : undefined;
    if (preflight) requireLifecycle(preflight.eligible, 'PREFLIGHT_FAILED', `Host cannot execute: ${preflight.blockers.join(', ')}${preflight.missingCapabilities.length ? ` (${preflight.missingCapabilities.join(', ')})` : ''}`);
    const work = async () => {
      const attempt = await requireAttempt(input.attemptId, home);
      const run = await requireRun(attempt.runId, home);
      const goal = await requireGoal(run.goalId, home);
      requireLifecycle(!terminal(attempt.status) && !['completed', 'canceled'].includes(goal.status), 'TERMINAL_ATTEMPT', 'Cannot claim finished work');
      requireLifecycle(!JSON.parse(attempt.statusSnapshotJson).completionRequested, 'REVIEW_PENDING', 'Execution is finished and waiting for its completion gates');
      requireLifecycle(!current?.cancellationRequestedAt, 'CANCELLATION_REQUESTED', 'Acknowledge cancellation instead of reclaiming');
      if (current?.ownerId) {
        const expired = !current.leaseExpiresAt || Date.parse(current.leaseExpiresAt) <= Date.now();
        requireLifecycle(expired ? input.reclaim : current.ownerId === input.ownerId && input.token === current.token,
          expired ? 'RECLAIM_REQUIRED' : 'ALREADY_CLAIMED', expired ? 'Lease expired; confirm reclaim explicitly' : 'Attempt already has a live owner');
        if (strict && expired) {
          requireLifecycle(current.ownerId === input.ownerId, 'RECOVERY_HOST_REQUIRED', 'Only the assigned host may recover its observed session; otherwise confirm it stopped and abandon');
          requireLifecycle(current.recoveryOutcome === 'active' && current.recoveryObservedAt && current.leaseExpiresAt && Date.parse(current.recoveryObservedAt) >= Date.parse(current.leaseExpiresAt), 'RECOVERY_REQUIRED', 'Reconcile the expired session as active before reclaiming; unknown sessions must remain blocked');
        }
      }
      const token = current?.ownerId && current.token && current.leaseExpiresAt && Date.parse(current.leaseExpiresAt) > Date.now() ? current.token : randomId('claim');
      const leaseExpiresAt = new Date(Date.now() + seconds * 1000).toISOString();
      const packet = { ...JSON.parse(current?.packetJson ?? '{}'), ...(preflight ? { harness: preflight.harness, workspace: preflight.workspace, workingPath: preflight.workspace.workingPath, hostId: input.ownerId } : {}) };
      const values = { packetJson: JSON.stringify(packet), ownerId: input.ownerId, token, leaseExpiresAt, claimedAt: current?.claimedAt ?? now(), recoveryOutcome: null, recoveryObservedAt: null, recoveryDetailsJson: '{}' };
      await db.insert(attemptClaims).values({ attemptId: attempt.id, ...values }).onConflictDoUpdate({ target: attemptClaims.attemptId, set: values });
      await db.update(runAttempts).set({ status: strict ? attempt.status : 'running', heartbeatAt: now(), startedAt: strict ? attempt.startedAt : attempt.startedAt ?? now(), ...(preflight ? { harness: preflight.harness, hostEnvironmentName: input.ownerId, workingPath: preflight.workspace.workingPath, statusSnapshotJson: JSON.stringify({ ...JSON.parse(attempt.statusSnapshotJson), hostPreflight: preflight }), checkpoint: attempt.startedAt ? attempt.checkpoint : 'claimed' } : {}), updatedAt: now() }).where(eq(runAttempts.id, attempt.id));
      if (strict) await db.update(executionHosts).set({ lastSeenAt: now() }).where(eq(executionHosts.id, input.ownerId));
      await emitEvent(db, input.reclaim ? 'attempt.reclaimed' : 'attempt.claimed', 'run-attempt', attempt.id, { ownerId: input.ownerId, protocolVersion: current?.protocolVersion ?? 1, ...(preflight ? { preflight } : {}) });
      return { attemptId: attempt.id, ownerId: input.ownerId, token, leaseExpiresAt, claimed: true, started: !!attempt.startedAt || !strict, packet };
    };
    // Preflight proves this specific host has an explicit project grant; general APIs stay scoped.
    return strict ? scopedApi({ work }, undefined).work() : work();
  });
}
export async function startAttempt(input: { attemptId: string; token: string; externalSessionId: string; parentSessionId: string; workingPath: string; resumeCommand?: string }, home?: string) {
  return withAttemptHostAccess(input.attemptId, input.token, home, () => atomic(home, async () => {
    const attempt = await requireAttempt(input.attemptId, home);
    const claim = await verifyOwner(attempt.id, input.token, home);
    requireLifecycle(claim?.ownerId, 'CLAIM_REQUIRED', 'Claim the attempt before recording a session');
    requireLifecycle(!terminal(attempt.status), 'TERMINAL_ATTEMPT', 'Attempt is terminal');
    requireLifecycle(!claim.cancellationRequestedAt, 'CANCELLATION_REQUESTED', 'Stop execution and acknowledge cancellation');
    requireLifecycle(input.externalSessionId.trim() && input.parentSessionId.trim() && input.externalSessionId !== input.parentSessionId, 'INDEPENDENT_SESSION_REQUIRED', 'The worker session must be distinct from its parent session');
    const db = openRuntimeDb(home);
    if (attempt.startedAt && attempt.externalSessionId) {
      requireLifecycle(attempt.externalSessionId === input.externalSessionId && claim.parentSessionId === input.parentSessionId && attempt.workingPath === input.workingPath, 'SESSION_CONFLICT', 'This attempt already has a different session');
      return attempt;
    }
    const preflight = await scopedApi({ check: () => hostPreflight({ attemptId: attempt.id, ownerId: claim.ownerId! }, home) }, undefined).check();
    requireLifecycle(preflight.eligible && preflight.workspace.workingPath === input.workingPath, 'PREFLIGHT_FAILED', 'Capabilities and the host-declared workspace must be available before starting');
    const duplicate = (await db.select().from(runAttempts).where(and(eq(runAttempts.hostEnvironmentName, claim.ownerId), eq(runAttempts.externalSessionId, input.externalSessionId), ne(runAttempts.id, attempt.id), notInArray(runAttempts.status, ['succeeded', 'failed', 'canceled']))))[0];
    requireLifecycle(!duplicate, 'SESSION_IN_USE', 'This host session is already assigned to another active attempt');
    const ts = now();
    await db.update(attemptClaims).set({ parentSessionId: input.parentSessionId }).where(eq(attemptClaims.attemptId, attempt.id));
    await db.update(runAttempts).set({ status: 'running', startedAt: ts, externalSessionId: input.externalSessionId, workingPath: input.workingPath, resumeCommand: input.resumeCommand ?? null, hostEnvironmentName: claim.ownerId, harness: preflight.harness, statusSnapshotJson: JSON.stringify({ ...JSON.parse(attempt.statusSnapshotJson), hostPreflight: preflight }), checkpoint: 'started', heartbeatAt: ts, updatedAt: ts }).where(eq(runAttempts.id, attempt.id));
    await db.update(runs).set({ status: 'executing', updatedAt: ts }).where(eq(runs.id, attempt.runId));
    await emitEvent(db, 'attempt.started', 'run-attempt', attempt.id, { hostId: claim.ownerId, externalSessionId: input.externalSessionId, parentSessionId: input.parentSessionId });
    return (await db.select().from(runAttempts).where(eq(runAttempts.id, attempt.id)))[0]!;
  }));
}

/** Operator recovery: never infer process termination from lease expiry. */
export async function abandonAttempt(input: { attemptId: string; confirmedStopped: boolean; reason: string; token?: string }, home?: string) {
  return withAttemptHostAccess(input.attemptId, input.token, home, () => atomic(home, async () => {
    const attempt = await requireAttempt(input.attemptId, home);
    requireLifecycle(input.confirmedStopped === true && input.reason.trim().length > 0, 'STOP_CONFIRMATION_REQUIRED', 'Confirm the external process stopped and provide a reason');
    requireLifecycle(!terminal(attempt.status), 'TERMINAL_ATTEMPT', 'Attempt is already terminal');
    const db = openRuntimeDb(home);
    const claim = (await db.select().from(attemptClaims).where(eq(attemptClaims.attemptId, attempt.id)))[0];
    if (input.token !== undefined) await verifyOwner(attempt.id, input.token, home, true);
    const token = randomId('revoked');
    const values = { ownerId: 'operator-recovery', token, leaseExpiresAt: new Date(Date.now() + 60_000).toISOString(), recoveryOutcome: 'missing', recoveryObservedAt: now(), recoveryDetailsJson: JSON.stringify({ reason: input.reason, confirmedStopped: true }) };
    await db.insert(attemptClaims).values({ attemptId: attempt.id, ...values }).onConflictDoUpdate({ target: attemptClaims.attemptId, set: values });
    const result = await updateRunAttempt(attempt.id, { status: claim?.cancellationRequestedAt ? 'canceled' : 'failed', token, failureSummary: input.reason }, home);
    await emitEvent(db, 'attempt.abandoned', 'run-attempt', attempt.id, { reason: input.reason, confirmedStopped: true });
    return result;
  }));
}
export async function heartbeatAttempt(input: { attemptId: string; token: string; leaseSeconds?: number }, home?: string) {
  return withAttemptHostAccess(input.attemptId, input.token, home, () => atomic(home, async () => {
    const attempt = await requireAttempt(input.attemptId, home);
    requireLifecycle(!terminal(attempt.status), 'TERMINAL_ATTEMPT', 'Attempt is terminal');
    const claim = await verifyOwner(attempt.id, input.token, home);
    requireLifecycle(claim?.ownerId, 'CLAIM_REQUIRED', 'Claim the attempt before sending heartbeats');
    const leaseExpiresAt = new Date(Date.now() + leaseDuration(input.leaseSeconds) * 1000).toISOString();
    await openRuntimeDb(home).update(attemptClaims).set({ leaseExpiresAt }).where(eq(attemptClaims.attemptId, attempt.id));
    await openRuntimeDb(home).update(runAttempts).set({ heartbeatAt: now(), updatedAt: now() }).where(eq(runAttempts.id, attempt.id));
    if (claim.protocolVersion === 2) await openRuntimeDb(home).update(executionHosts).set({ lastSeenAt: now() }).where(eq(executionHosts.id, claim.ownerId));
    return { attemptId: attempt.id, leaseExpiresAt, cancellationRequested: !!claim.cancellationRequestedAt };
  }));
}

export async function reconcileAttempt(input: { attemptId: string; ownerId: string; outcome: 'active' | 'finished' | 'missing' | 'unknown'; details: string; externalSessionId?: string; token?: string; status?: 'succeeded' | 'failed' | 'canceled'; result?: Record<string, unknown> }, home?: string) {
  return atomic(home, async () => {
    await requireHost(input.ownerId, home);
    const db = openRuntimeDb(home);
    const claim = (await db.select().from(attemptClaims).where(eq(attemptClaims.attemptId, input.attemptId)))[0];
    requireLifecycle(claim?.ownerId === input.ownerId, 'RECOVERY_HOST_REQUIRED', 'Only the assigned host can report its session inspection');
    requireLifecycle(input.details.trim(), 'INVALID_INPUT', 'Describe how the external session was inspected');
    requireLifecycle(['active', 'finished', 'missing', 'unknown'].includes(input.outcome), 'INVALID_INPUT', 'Unknown recovery outcome');
    return scopedApi({ work: async () => {
      const attempt = await requireAttempt(input.attemptId, home);
      if (claim.recoveryOutcome === 'finished' && input.outcome === 'finished') {
        requireLifecycle(input.externalSessionId === attempt.externalSessionId && input.status === (JSON.parse(attempt.statusSnapshotJson).completionRequested ? 'succeeded' : attempt.status) && (input.result === undefined || isDeepStrictEqual(input.result, JSON.parse(attempt.resultJson))), 'RESULT_CONFLICT', 'The reconciled result is immutable');
        return { attemptId: attempt.id, outcome: input.outcome, status: attempt.status, nextAction: attempt.status === 'paused' ? 'Provide required evidence or review' : 'Plan again' };
      }
      requireLifecycle(!claim.leaseExpiresAt || Date.parse(claim.leaseExpiresAt) <= Date.now() || input.token === claim.token, 'ALREADY_CLAIMED', 'A live lease requires the current token');
      requireLifecycle(!terminal(attempt.status), 'TERMINAL_ATTEMPT', 'Attempt is already terminal');
      if (input.outcome === 'active' || input.outcome === 'finished') requireLifecycle(attempt.externalSessionId && input.externalSessionId === attempt.externalSessionId, 'SESSION_CONFLICT', 'Inspect and identify the recorded external session');
      if (input.outcome === 'finished') requireLifecycle(input.status && ['succeeded', 'failed', 'canceled'].includes(input.status), 'RESULT_REQUIRED', 'Finished recovery requires a terminal status and any result');
      const ts = now();
      const observation = { recoveryOutcome: input.outcome, recoveryObservedAt: ts, recoveryDetailsJson: JSON.stringify({ details: input.details, externalSessionId: input.externalSessionId ?? null }) };
      await db.update(attemptClaims).set(observation).where(eq(attemptClaims.attemptId, input.attemptId));
      await emitEvent(db, 'attempt.reconciled', 'run-attempt', input.attemptId, { outcome: input.outcome, details: input.details, ownerId: input.ownerId });
      if (input.outcome === 'finished') {
        const token = randomId('reconciled');
        await db.update(attemptClaims).set({ token, leaseExpiresAt: new Date(Date.now() + 120_000).toISOString() }).where(eq(attemptClaims.attemptId, attempt.id));
        const result = await updateRunAttempt(attempt.id, { token, status: input.status, result: input.result }, home);
        return { attemptId: attempt.id, outcome: input.outcome, status: result.status, nextAction: result.status === 'paused' ? 'Provide required evidence or review' : 'Plan again' };
      }
      return { attemptId: attempt.id, outcome: input.outcome, status: attempt.status, nextAction: input.outcome === 'active' ? 'Reclaim ownership and continue the existing session; do not launch another' : input.outcome === 'missing' ? 'After confirming the process stopped, explicitly abandon this attempt' : 'Keep blocked until the existing session can be inspected' };
    } }, undefined).work();
  });
}
