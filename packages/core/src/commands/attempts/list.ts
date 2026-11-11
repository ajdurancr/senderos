import type { RunAttemptRecord } from '../../shared/types';
import { openRuntimeDb } from '../../db/client';
import { attemptClaims, goals, projects, runAttempts, runs } from '../../db/schema';
import { executionHosts, hostWorkspaces } from '../../db/host-schema';
import { and, asc, eq, inArray, isNotNull, or } from 'drizzle-orm';
import { inspectedAttempt, inspectionClaimFields } from './inspection';

export async function listRunAttempts(runId?: string, home?: string, executionContextId?: string) {
  const db = openRuntimeDb(home);
  const contextHosts = db.select({ id: executionHosts.id }).from(executionHosts)
    .where(eq(executionHosts.executionContextId, executionContextId ?? ''));
  const grantedProjects = db.select({ id: hostWorkspaces.projectId }).from(hostWorkspaces)
    .where(and(eq(hostWorkspaces.accessGranted, true), inArray(hostWorkspaces.hostId, contextHosts)));
  // Match single-attempt inspection: a valid parent project is required even for
  // assigned hosts. A withdrawn grant still permits inspection of owned sessions.
  const scope = executionContextId ? and(isNotNull(projects.id), or(
    eq(projects.executionContextId, executionContextId),
    inArray(projects.id, grantedProjects),
    inArray(attemptClaims.ownerId, contextHosts),
  )) : undefined;
  const rows = await db.select({ attempt: runAttempts, claim: inspectionClaimFields }).from(runAttempts)
    .leftJoin(attemptClaims, eq(attemptClaims.attemptId, runAttempts.id))
    .leftJoin(runs, eq(runAttempts.runId, runs.id))
    .leftJoin(goals, eq(runs.goalId, goals.id))
    .leftJoin(projects, eq(goals.projectId, projects.id))
    .where(and(runId ? eq(runAttempts.runId, runId) : undefined,
      scope))
    .orderBy(runId ? asc(runAttempts.attemptNumber) : asc(runAttempts.createdAt));
  return rows.map(({ attempt, claim }) => inspectedAttempt(attempt as RunAttemptRecord, claim));
}
