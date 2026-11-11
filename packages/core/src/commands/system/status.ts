import { completeTogether } from "../../shared/complete-together";
import { openRuntimeDb } from "../../db/client";
import { attemptClaims, goals, projects, runAttempts, runs } from "../../db/schema";
import { and, asc, count, eq, inArray, notInArray } from "drizzle-orm";
import type { ProjectRecord, GoalRecord, RunRecord, RunAttemptRecord } from "../../shared/types";
import { attemptInspectionScope } from '../attempts/inspection';
const ACTIVE_RUN_STATUSES = [
  "queued",
  "preparing",
  "executing",
  "validating",
  "repairing",
  "merging",
  "updating_pr",
  "cleaning_up",
];
export async function status(home?: string, executionContextId?: string) {
  const db = openRuntimeDb(home);
  if (executionContextId) {
    const [scopedProjects, scopedGoals, scopedRuns, scopedAttempts] = await completeTogether([
      db.select({ status: projects.status }).from(projects)
        .where(eq(projects.executionContextId, executionContextId)),
      db.select({ id: goals.id, status: goals.status }).from(goals)
        .innerJoin(projects, eq(goals.projectId, projects.id))
        .where(and(eq(projects.executionContextId, executionContextId), notInArray(goals.status, ["completed", "canceled"])))
        .orderBy(asc(goals.createdAt)),
      db.select({ id: runs.id, status: runs.status }).from(runs)
        .innerJoin(goals, eq(runs.goalId, goals.id))
        .innerJoin(projects, eq(goals.projectId, projects.id))
        .where(and(eq(projects.executionContextId, executionContextId), inArray(runs.status, ACTIVE_RUN_STATUSES)))
        .orderBy(asc(runs.createdAt)),
      db.select({ id: runAttempts.id, status: runAttempts.status }).from(runAttempts)
        .leftJoin(attemptClaims, eq(attemptClaims.attemptId, runAttempts.id))
        .leftJoin(runs, eq(runAttempts.runId, runs.id))
        .leftJoin(goals, eq(runs.goalId, goals.id))
        .leftJoin(projects, eq(goals.projectId, projects.id))
        .where(and(attemptInspectionScope(db, executionContextId), inArray(runAttempts.status, ["queued", "running", "paused"])))
        .orderBy(asc(runAttempts.createdAt)),
    ]);
    return statusFromRecords(
      scopedProjects as Pick<ProjectRecord, 'status'>[],
      scopedGoals as Pick<GoalRecord, 'id' | 'status'>[],
      scopedRuns as Pick<RunRecord, 'id' | 'status'>[],
      scopedAttempts as Pick<RunAttemptRecord, 'id' | 'status'>[],
    );
  }
  const activeAttemptRows = await db
      .select({ id: runAttempts.id })
      .from(runAttempts)
      .where(inArray(runAttempts.status, ["queued", "running", "paused"]))
      .orderBy(asc(runAttempts.createdAt));
  const activeAttempts: string[] = [];
  for (const row of activeAttemptRows) activeAttempts.push(row.id);
  const [
    projectTotals,
    unhealthyProjects,
    openGoals,
    activeRuns,
    activeGoals,
    runningRuns,
  ] = await completeTogether([
    db.select({ count: count() }).from(projects),
    db
      .select({ count: count() })
      .from(projects)
      .where(notInArray(projects.status, ["healthy"])),
    db
      .select({ count: count() })
      .from(goals)
      .where(notInArray(goals.status, ["completed", "canceled"])),
    db
      .select({ count: count() })
      .from(runs)
      .where(inArray(runs.status, ACTIVE_RUN_STATUSES)),
    db
      .select({ id: goals.id })
      .from(goals)
      .where(notInArray(goals.status, ["completed", "canceled"]))
      .orderBy(asc(goals.createdAt)),
    db
      .select({ id: runs.id })
      .from(runs)
      .where(inArray(runs.status, ACTIVE_RUN_STATUSES))
      .orderBy(asc(runs.createdAt)),
  ]);
  const activeGoalIds: string[] = [];
  const runningRunIds: string[] = [];
  for (const row of activeGoals) activeGoalIds.push(row.id);
  for (const row of runningRuns) runningRunIds.push(row.id);
  const summary = {
    projects: {
      total: projectTotals[0]?.count ?? 0,
      unhealthy: unhealthyProjects[0]?.count ?? 0,
    },
    openGoals: openGoals[0]?.count ?? 0,
    activeRuns: activeRuns[0]?.count ?? 0,
    activeAttemptIds: activeAttempts,
    activeGoalIds,
    runningRunIds,
  };
  return summary;
}

/** Summarize already selected records without loading another complete snapshot. */
export function statusFromRecords(
  selectedProjects: Pick<ProjectRecord, 'status'>[],
  selectedGoals: Pick<GoalRecord, 'id' | 'status'>[],
  selectedRuns: Pick<RunRecord, 'id' | 'status'>[],
  selectedAttempts: Pick<RunAttemptRecord, 'id' | 'status'>[],
) {
  const activeGoalIds = selectedGoals.filter(goal => !['completed', 'canceled'].includes(goal.status)).map(goal => goal.id);
  const runningRunIds = selectedRuns.filter(run => ACTIVE_RUN_STATUSES.includes(run.status)).map(run => run.id);
  return {
    projects: { total: selectedProjects.length, unhealthy: selectedProjects.filter(project => project.status !== 'healthy').length },
    openGoals: activeGoalIds.length,
    activeRuns: runningRunIds.length,
    activeAttemptIds: selectedAttempts.filter(attempt => ['queued', 'running', 'paused'].includes(attempt.status)).map(attempt => attempt.id),
    activeGoalIds,
    runningRunIds,
  };
}
