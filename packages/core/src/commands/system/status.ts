import { openRuntimeDb } from '../../db/client';
import { sql } from 'drizzle-orm';
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
  const activeAttempts = (await db.all(sql`select id from run_attempts where status in ('queued','running','paused') order by created_at asc`))
    .map((row: any) => row.id);
  const [projectTotals, unhealthyProjects, openGoals, activeRuns, activeGoals, runningRuns] = await Promise.all([
    db.get(sql`select count(*) as c from projects`),
    db.get(sql`select count(*) as c from projects where status != 'healthy'`),
    db.get(sql`select count(*) as c from goals where status not in ('completed','canceled')`),
    db.get(sql`select count(*) as c from runs where status in ('queued','preparing','executing','validating','repairing','merging','updating_pr','cleaning_up')`),
    db.all(sql`select id from goals where status not in ('completed','canceled') order by created_at asc`),
    db.all(sql`select id from runs where status in ('queued','preparing','executing','validating','repairing','merging','updating_pr','cleaning_up') order by created_at asc`),
  ]);
  const summary = {
    projects: {
      total: (projectTotals as any).c,
      unhealthy: (unhealthyProjects as any).c,
    },
    openGoals: (openGoals as any).c,
    activeRuns: (activeRuns as any).c,
    activeAttemptIds: activeAttempts,
    activeGoalIds: activeGoals.map((row: any) => row.id),
    runningRunIds: runningRuns.map((row: any) => row.id),
  };
  return summary;
}
