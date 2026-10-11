import { getRunAttempt } from '../attempts/get';
import { currentExecutionContextId } from '../../lifecycle/scope';
import { requireLifecycle } from '../../lifecycle/errors';
import { openRuntimeDb } from '../../db/client';
import { attemptClaims } from '../../db/schema';
import { eq } from 'drizzle-orm';

/** Inspection only: never execute stored commands or imply local session availability. */
export async function resumeAttempt(id: string, home?: string) {
  const attempt = await getRunAttempt(id, home, currentExecutionContextId(home));
  requireLifecycle(attempt, 'NOT_FOUND', `Attempt not found in the current execution context: ${id}`);
  const claim = (await openRuntimeDb(home).select().from(attemptClaims).where(eq(attemptClaims.attemptId, id)))[0];
  return { attempt, resumeCommand: attempt.resumeCommand, packet: JSON.parse(claim?.packetJson ?? '{}'), cancellationRequested: !!claim?.cancellationRequestedAt,
    nextAction: ['succeeded', 'failed', 'canceled'].includes(attempt.status) ? 'none' : claim?.cancellationRequestedAt ? 'acknowledge_cancel' : claim?.ownerId ? 'renew_or_reclaim' : 'claim' };
}
