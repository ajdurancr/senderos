import { getRunAttempt } from "../attempts/get";
import { requireAttempt } from "../../lifecycle/scope";
import { openRuntimeDb } from '../../db/client';
import { attemptClaims } from '../../db/schema';
import { eq } from 'drizzle-orm';
export async function resumeAttempt(id: string, home?: string) {
  const attempt = await requireAttempt(id, home);
  if (!attempt) throw new Error(`Run attempt not found: ${id}`);
  const claim = (await openRuntimeDb(home).select().from(attemptClaims).where(eq(attemptClaims.attemptId, id)))[0];
  return { attempt, resumeCommand: attempt.resumeCommand, packet: JSON.parse(claim?.packetJson ?? '{}'), cancellationRequested: !!claim?.cancellationRequestedAt,
    nextAction: ['succeeded', 'failed', 'canceled'].includes(attempt.status) ? 'none' : claim?.cancellationRequestedAt ? 'acknowledge_cancel' : claim?.ownerId ? 'renew_or_reclaim' : 'claim' };
}
