import { openRuntimeDb } from "../../db/client";
import { goals, projects, runAttempts, runs } from "../../db/schema";
import { asc, count, inArray, notInArray } from "drizzle-orm";
import type { ProjectRecord, GoalRecord, RunRecord, RunAttemptRecord } from "../../shared/types";
import { listProjects } from '../projects/list';
import { listGoals } from '../goals/list';
import { listRuns } from '../runs/list';
import { listRunAttempts } from '../attempts/list';
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
  if (executionContextId) {
    const [scopedProjects, scopedGoals, scopedRuns, scopedAttempts] = await Promise.all([
      listProjects(home, executionContextId),
      listGoals(home, executionContextId),
      listRuns(home, executionContextId),
      listRunAttempts(undefined, home, executionContextId),
    ]);
    return statusFromRecords(scopedProjects, scopedGoals, scopedRuns, scopedAttempts);
  }
  const db = openRuntimeDb(home);
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
  ] = await Promise.all([
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
