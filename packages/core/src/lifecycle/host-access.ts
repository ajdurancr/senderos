import { eq } from 'drizzle-orm';
import { openRuntimeDb } from '../db/client';
import { attemptClaims } from '../db/schema';
import { requireAttempt, scopedApi } from './scope';
import { requireHost } from './host-registry';
import { requireLifecycle } from './errors';

/** Only an assigned host may cross a project context, for this specific attempt. */
export async function withAttemptHostAccess<T>(attemptId: string, token: string | undefined, home: string | undefined, work: () => Promise<T>): Promise<T> {
  try {
    await requireAttempt(attemptId, home);
    return work();
  } catch (error) {
    if ((error as { code?: string }).code !== 'NOT_FOUND') throw error;
    const claim = (await openRuntimeDb(home).select().from(attemptClaims).where(eq(attemptClaims.attemptId, attemptId)))[0];
    requireLifecycle(claim?.ownerId && token && claim.token === token, 'NOT_FOUND', 'Attempt not found in the current execution context');
    await requireHost(claim.ownerId, home);
    return scopedApi({ work }, undefined).work();
  }
}
