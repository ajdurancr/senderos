import { openRuntimeDb } from '../../../db/client';

const ACTIVE_RUN_STATUSES = ['queued', 'preparing', 'executing', 'validating', 'repairing', 'merging', 'updating_pr', 'cleaning_up'];

export function status(home?: string) {
  const db = openRuntimeDb(home);

  const summary = {
    projects: {
      total: (db.query('select count(*) as c from projects').get() as any).c,
      unhealthy: (db.query("select count(*) as c from projects where status != 'healthy'").get() as any).c,
    },
    openFeatures: (db.query("select count(*) as c from features where status not in ('completed','canceled')").get() as any).c,
    activeLoops: (db.query("select count(*) as c from features where loop_phase not in ('idle','done','blocked')").get() as any).c,
    activeRuns: (db.query(`select count(*) as c from runs where status in (${ACTIVE_RUN_STATUSES.map((s) => `'${s}'`).join(',')})`).get() as any).c,
    pendingTasks: (db.query("select count(*) as c from tasks where status in ('pending','ready','running')").get() as any).c,
    sessionHealth:
      (db.query("select count(*) as c from sessions where status='stale'").get() as any).c === 0
        ? 'ok'
        : 'stale',
    workspaceLocks: (db.query("select count(*) as c from workspaces where status in ('locked','active','verifying')").get() as any).c,
    pendingReconciliation: (db.query("select count(*) as c from sessions where status='stale'").get() as any).c,
    activeFeatureIds: db.query("select id from features where status not in ('completed','canceled') order by created_at asc").all().map((row: any) => row.id),
    runningRunIds: db.query(`select id from runs where status in (${ACTIVE_RUN_STATUSES.map((s) => `'${s}'`).join(',')}) order by created_at asc`).all().map((row: any) => row.id),
    activeSessionIds: db.query("select id from sessions where status='active' order by created_at asc").all().map((row: any) => row.id),
    lockedWorkspaceIds: db.query("select id from workspaces where status in ('locked','active','verifying') order by created_at asc").all().map((row: any) => row.id),
  };

  db.close();
  return summary;
}
