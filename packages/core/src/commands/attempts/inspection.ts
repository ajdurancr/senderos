import { and, eq } from 'drizzle-orm';
import { openRuntimeDb } from '../../db/client';
import { attemptClaims, goals, projects, runs } from '../../db/schema';
import { executionHosts, hostWorkspaces } from '../../db/host-schema';
import type { RunAttemptRecord } from '../../shared/types';

/** Never include claim tokens in ordinary attempt inspection or Studio payloads. */
export async function inspectAttempt(attempt: RunAttemptRecord, home?: string) {
  const claim = (await openRuntimeDb(home).select({ ownerId: attemptClaims.ownerId, leaseExpiresAt: attemptClaims.leaseExpiresAt, claimedAt: attemptClaims.claimedAt, protocolVersion: attemptClaims.protocolVersion, parentSessionId: attemptClaims.parentSessionId, cancellationRequestedAt: attemptClaims.cancellationRequestedAt, recoveryOutcome: attemptClaims.recoveryOutcome, recoveryObservedAt: attemptClaims.recoveryObservedAt, recoveryDetailsJson: attemptClaims.recoveryDetailsJson }).from(attemptClaims).where(eq(attemptClaims.attemptId, attempt.id)))[0];
  return { ...attempt, ownerId: claim?.ownerId ?? null, leaseExpiresAt: claim?.leaseExpiresAt ?? null, claimedAt: claim?.claimedAt ?? null, parentSessionId: claim?.parentSessionId ?? null, protocolVersion: claim?.protocolVersion ?? 1, cancellationRequestedAt: claim?.cancellationRequestedAt ?? null, recoveryOutcome: claim?.recoveryOutcome ?? null, recoveryObservedAt: claim?.recoveryObservedAt ?? null, recoveryDetails: JSON.parse(claim?.recoveryDetailsJson ?? '{}') as Record<string, unknown>, preflight: (JSON.parse(attempt.statusSnapshotJson).hostPreflight ?? null) as Record<string, unknown> | null };
}
export async function canReadAttempt(attempt: RunAttemptRecord, executionContextId: string, home?: string) {
  const db = openRuntimeDb(home);
  const row = (await db.select({ project: projects }).from(runs).innerJoin(goals, eq(runs.goalId, goals.id)).innerJoin(projects, eq(goals.projectId, projects.id)).where(eq(runs.id, attempt.runId)))[0];
  if (!row) return false;
  if (row.project.executionContextId === executionContextId) return true;
  const granted = (await db.select({ id: hostWorkspaces.id }).from(hostWorkspaces).innerJoin(executionHosts, eq(hostWorkspaces.hostId, executionHosts.id)).where(and(eq(hostWorkspaces.projectId, row.project.id), eq(hostWorkspaces.accessGranted, true), eq(executionHosts.executionContextId, executionContextId))))[0];
  if (granted) return true;
  // An assigned host can still inspect/cancel its session after an access grant is withdrawn.
  return !!(await db.select({ id: executionHosts.id }).from(attemptClaims).innerJoin(executionHosts, eq(attemptClaims.ownerId, executionHosts.id)).where(and(eq(attemptClaims.attemptId, attempt.id), eq(executionHosts.executionContextId, executionContextId))))[0];
}
