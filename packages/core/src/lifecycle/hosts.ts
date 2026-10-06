import { eq } from "drizzle-orm";
import { atomic, openRuntimeDb } from "../db/client";
import { attemptClaims, runAttempts } from "../db/schema";
import { now, randomId } from "../shared/ids";
import { emitEvent } from "../shared/events";
import { requireAttempt, requireRun, requireGoal } from "./scope";
import { requireLifecycle } from "./errors";
import { terminal } from "./state";
import { updateRunAttempt } from "../commands/attempts/update";

export async function verifyOwner(attemptId: string, token: string | undefined, home?: string, allowExpired = false) {
  const claim = (await openRuntimeDb(home).select().from(attemptClaims).where(eq(attemptClaims.attemptId, attemptId)))[0];
  if (claim?.ownerId) {
    requireLifecycle(token && token === claim.token, "STALE_OWNER", "Current claim token is required");
    requireLifecycle(allowExpired || (claim.leaseExpiresAt && Date.parse(claim.leaseExpiresAt) > Date.now()), "LEASE_EXPIRED", "Lease expired; explicitly reclaim before reporting");
  }
  return claim;
}
export async function claimAttempt(input: { attemptId: string; ownerId: string; leaseSeconds?: number; reclaim?: boolean; token?: string }, home?: string) {
  return atomic(home, async () => {
    const attempt = await requireAttempt(input.attemptId, home);
    const run = await requireRun(attempt.runId, home);
    const goal = await requireGoal(run.goalId, home);
    requireLifecycle(!terminal(attempt.status) && !["completed", "canceled"].includes(goal.status), "TERMINAL_ATTEMPT", "Cannot claim finished work");
    requireLifecycle(!JSON.parse(attempt.statusSnapshotJson).completionRequested, "REVIEW_PENDING", "Execution is finished and waiting for its completion gates");
    requireLifecycle(input.ownerId.trim().length > 0, "INVALID_INPUT", "ownerId is required");
    const seconds = input.leaseSeconds ?? 120;
    requireLifecycle(Number.isInteger(seconds) && seconds >= 10 && seconds <= 3600, "INVALID_INPUT", "leaseSeconds must be between 10 and 3600");
    const db = openRuntimeDb(home);
    const current = (await db.select().from(attemptClaims).where(eq(attemptClaims.attemptId, attempt.id)))[0];
    requireLifecycle(!current?.cancellationRequestedAt, "CANCELLATION_REQUESTED", "Acknowledge cancellation instead of reclaiming");
    if (current?.ownerId) {
      const expired = !current.leaseExpiresAt || Date.parse(current.leaseExpiresAt) <= Date.now();
      requireLifecycle(expired ? input.reclaim : current.ownerId === input.ownerId && input.token === current.token,
        expired ? "RECLAIM_REQUIRED" : "ALREADY_CLAIMED", expired ? "Lease expired; confirm reclaim explicitly" : "Attempt already has a live owner");
    }
    const token = current?.ownerId && current.token && current.leaseExpiresAt && Date.parse(current.leaseExpiresAt) > Date.now() ? current.token : randomId("claim");
    const leaseExpiresAt = new Date(Date.now() + seconds * 1000).toISOString();
    await db.insert(attemptClaims).values({ attemptId: attempt.id, ownerId: input.ownerId, token, leaseExpiresAt })
      .onConflictDoUpdate({ target: attemptClaims.attemptId, set: { ownerId: input.ownerId, token, leaseExpiresAt } });
    await db.update(runAttempts).set({ status: "running", heartbeatAt: now(), startedAt: attempt.startedAt ?? now(), updatedAt: now() }).where(eq(runAttempts.id, attempt.id));
    await emitEvent(db, input.reclaim ? "attempt.reclaimed" : "attempt.claimed", "run-attempt", attempt.id, { ownerId: input.ownerId });
    return { attemptId: attempt.id, ownerId: input.ownerId, token, leaseExpiresAt, packet: JSON.parse(current?.packetJson ?? "{}") };
  });
}

/** Operator recovery: never infer process termination from lease expiry. */
export async function abandonAttempt(input: { attemptId: string; confirmedStopped: boolean; reason: string }, home?: string) {
  return atomic(home, async () => {
    const attempt = await requireAttempt(input.attemptId, home);
    requireLifecycle(input.confirmedStopped === true && input.reason.trim().length > 0, "STOP_CONFIRMATION_REQUIRED", "Confirm the external process stopped and provide a reason");
    requireLifecycle(!terminal(attempt.status), "TERMINAL_ATTEMPT", "Attempt is already terminal");
    const db = openRuntimeDb(home);
    const claim = (await db.select().from(attemptClaims).where(eq(attemptClaims.attemptId, attempt.id)))[0];
    const token = randomId('revoked');
    await db.insert(attemptClaims).values({ attemptId: attempt.id, ownerId: 'operator-recovery', token, leaseExpiresAt: new Date(Date.now() + 60_000).toISOString() })
      .onConflictDoUpdate({ target: attemptClaims.attemptId, set: { ownerId: 'operator-recovery', token, leaseExpiresAt: new Date(Date.now() + 60_000).toISOString() } });
    const result = await updateRunAttempt(attempt.id, { status: claim?.cancellationRequestedAt ? 'canceled' : 'failed', token, failureSummary: input.reason }, home);
    await emitEvent(db, 'attempt.abandoned', 'run-attempt', attempt.id, { reason: input.reason, confirmedStopped: true });
    return result;
  });
}
export async function heartbeatAttempt(input: { attemptId: string; token: string; leaseSeconds?: number }, home?: string) {
  return atomic(home, async () => {
    const attempt = await requireAttempt(input.attemptId, home);
    requireLifecycle(!terminal(attempt.status), "TERMINAL_ATTEMPT", "Attempt is terminal");
    const claim = await verifyOwner(attempt.id, input.token, home);
    requireLifecycle(claim?.ownerId, "CLAIM_REQUIRED", "Claim the attempt before sending heartbeats");
    const seconds = input.leaseSeconds ?? 120;
    requireLifecycle(Number.isInteger(seconds) && seconds >= 10 && seconds <= 3600, "INVALID_INPUT", "leaseSeconds must be between 10 and 3600");
    const leaseExpiresAt = new Date(Date.now() + seconds * 1000).toISOString();
    await openRuntimeDb(home).update(attemptClaims).set({ leaseExpiresAt }).where(eq(attemptClaims.attemptId, attempt.id));
    await openRuntimeDb(home).update(runAttempts).set({ heartbeatAt: now(), updatedAt: now() }).where(eq(runAttempts.id, attempt.id));
    return { attemptId: attempt.id, leaseExpiresAt, cancellationRequested: !!claim.cancellationRequestedAt };
  });
}
