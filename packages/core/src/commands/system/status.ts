import { openRuntimeDb } from '../../db/client';
import { goals, projects, runAttempts, runs } from '../../db/schema';
import { asc, count, inArray, notInArray } from 'drizzle-orm';
const ACTIVE_RUN_STATUSES = [
  'queued',
  'preparing',
  'executing',
  'validating',
  'repairing',
  'merging',
  'updating_pr',
  'cleaning_up',
];
export async function status(home?: string) {
  const db = openRuntimeDb(home);
  const activeAttempts = (await db.select({ id: runAttempts.id }).from(runAttempts).where(inArray(runAttempts.status, ['queued', 'running', 'paused'])).orderBy(asc(runAttempts.createdAt)))
    .map((row) => row.id);
  const [projectTotals, unhealthyProjects, openGoals, activeRuns, activeGoals, runningRuns] = await Promise.all([
    db.select({ count: count() }).from(projects),
    db.select({ count: count() }).from(projects).where(notInArray(projects.status, ['healthy'])),
    db.select({ count: count() }).from(goals).where(notInArray(goals.status, ['completed', 'canceled'])),
    db.select({ count: count() }).from(runs).where(inArray(runs.status, ACTIVE_RUN_STATUSES)),
    db.select({ id: goals.id }).from(goals).where(notInArray(goals.status, ['completed', 'canceled'])).orderBy(asc(goals.createdAt)),
    db.select({ id: runs.id }).from(runs).where(inArray(runs.status, ACTIVE_RUN_STATUSES)).orderBy(asc(runs.createdAt)),
  ]);
  const summary = {
    projects: {
      total: projectTotals[0]?.count ?? 0,
      unhealthy: unhealthyProjects[0]?.count ?? 0,
    },
    openGoals: openGoals[0]?.count ?? 0,
    activeRuns: activeRuns[0]?.count ?? 0,
    activeAttemptIds: activeAttempts,
    activeGoalIds: activeGoals.map((row) => row.id),
    runningRunIds: runningRuns.map((row) => row.id),
  };
  return summary;
}
