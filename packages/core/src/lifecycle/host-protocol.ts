import type { attemptClaims, runAttempts } from '../db/schema';
import { requireLifecycle } from './errors';

/** New protocol attempts cannot report execution without a recorded independent session. */
export function enforceStartedAttempt(
  current: typeof runAttempts.$inferSelect,
  input: { status?: string; externalSessionId?: string | null; workingPath?: string | null; harness?: string; hostEnvironmentName?: string | null },
  claim: typeof attemptClaims.$inferSelect | undefined,
) {
  if (claim?.protocolVersion !== 2) return;
  requireLifecycle(claim.ownerId, 'CLAIM_REQUIRED', 'Claim this attempt before reporting');
  requireLifecycle(input.externalSessionId === undefined || input.externalSessionId === current.externalSessionId, 'SESSION_IMMUTABLE', 'Use attempt start to declare an independent session; its identity is immutable');
  requireLifecycle(input.workingPath === undefined || input.workingPath === current.workingPath, 'WORKSPACE_IMMUTABLE', 'Use attempt start to declare the executing workspace');
  requireLifecycle(input.harness === undefined || input.harness === current.harness, 'HOST_IMMUTABLE', 'The executing host determines the harness');
  requireLifecycle(input.hostEnvironmentName === undefined || input.hostEnvironmentName === current.hostEnvironmentName, 'HOST_IMMUTABLE', 'The executing host determines its location');
  if (['running', 'paused', 'succeeded'].includes(input.status ?? current.status)) {
    requireLifecycle(current.startedAt && current.externalSessionId && claim.parentSessionId && current.externalSessionId !== claim.parentSessionId, 'SESSION_REQUIRED', 'Start an independent worker session and record it with attempt start before reporting execution');
  }
}
