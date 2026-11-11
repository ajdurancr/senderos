import type { RunAttemptRecord } from '../../shared/types';
import { openRuntimeDb } from '../../db/client';
import { attemptClaims, goals, projects, runAttempts, runs } from '../../db/schema';
import { and, asc, eq } from 'drizzle-orm';
import { attemptInspectionScope, inspectedAttempt, inspectionClaimFields } from './inspection';

export async function listRunAttempts(runId?: string, home?: string, executionContextId?: string, projectId?: string) {
  const db = openRuntimeDb(home);
  const rows = await db.select({ attempt: runAttempts, claim: inspectionClaimFields }).from(runAttempts)
    .leftJoin(attemptClaims, eq(attemptClaims.attemptId, runAttempts.id))
    .leftJoin(runs, eq(runAttempts.runId, runs.id))
    .leftJoin(goals, eq(runs.goalId, goals.id))
    .leftJoin(projects, eq(goals.projectId, projects.id))
    .where(and(runId ? eq(runAttempts.runId, runId) : undefined,
      projectId ? eq(goals.projectId, projectId) : undefined, attemptInspectionScope(db, executionContextId)))
    .orderBy(runId ? asc(runAttempts.attemptNumber) : asc(runAttempts.createdAt));
  return rows.map(({ attempt, claim }) => inspectedAttempt(attempt as RunAttemptRecord, claim));
}
