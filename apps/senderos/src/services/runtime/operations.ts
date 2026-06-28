import { existsSync, writeFileSync } from 'node:fs';

import {
  configPathForHome,
  defaultHomePath,
  ensureWithinHome,
  initializeRuntime,
  loadConfig,
  previewInit,
  resolveRuntime,
  runtimeExists,
} from '../../config/runtime';
import { healthcheckCurrentDb, describeCurrentDb, openDb } from '../../db/client';
import { now } from '../../utils/common';
import { emitEvent } from '../events';
import {
  getRun,
  getSession,
  getWorkspace,
  listTasks,
  startLoopForFeature,
  tickLoopForFeature,
} from '../loop';
import { getFeature } from './features';

export { defaultHomePath, initializeRuntime, loadConfig, previewInit, resolveRuntime };

export function startLoop(featureId: string, home?: string) {
  const feature = getFeature(featureId, home);

  if (!feature) {
    throw new Error(`Feature not found: ${featureId}`);
  }

  if (!['ready_contract', 'active_implementation', 'failed'].includes(feature.status)) {
    throw new Error(`Feature is not dispatchable from status ${feature.status}`);
  }

  const result = startLoopForFeature(feature, home);

  return {
    feature: getFeature(feature.id, home),
    run: result.run,
    session: result.session,
    task: result.task,
  };
}

export function tickLoop(featureId: string, home?: string) {
  const feature = getFeature(featureId, home);

  if (!feature) {
    throw new Error(`Feature not found: ${featureId}`);
  }

  const result = tickLoopForFeature(feature, home);

  return {
    feature: getFeature(feature.id, home),
    run: result.run,
    task: result.task,
  };
}

export function showLoop(featureId: string, home?: string) {
  const feature = getFeature(featureId, home);

  if (!feature) {
    throw new Error(`Feature not found: ${featureId}`);
  }

  const tasks = listTasks(featureId, home) as any[];
  const nextTask = tasks.find((task) => ['ready', 'running', 'pending'].includes(task.status));

  return {
    feature,
    tasks,
    currentRun: feature.currentRunId ? getRun(feature.currentRunId, home) : null,
    workspace: feature.currentWorkspaceId ? getWorkspace(feature.currentWorkspaceId, home) : null,
    nextDispatch: nextTask ? JSON.parse(nextTask.instructionJson) : null,
  };
}

export function listRuns(home?: string) {
  const db = openDb(home);
  const rows = db.query('select * from runs order by created_at asc').all();
  db.close();
  return rows;
}

export function cancelRun(id: string, home?: string) {
  const db = openDb(home);
  const run = db.query('select * from runs where id=?').get(id) as any;

  if (!run) {
    db.close();
    throw new Error(`Run not found: ${id}`);
  }

  db.prepare('update runs set status=?, updated_at=? where id=?').run('canceled', now(), id);

  if (run.task_id) {
    db.prepare('update tasks set status=?, updated_at=? where id=?').run('canceled', now(), run.task_id);
  }

  emitEvent(db, 'run.canceled', 'run', id, {});
  db.close();

  return getRun(id, home);
}

export function listSessions(home?: string) {
  const db = openDb(home);
  const rows = db.query('select * from sessions order by created_at asc').all();
  db.close();
  return rows;
}

export function resumeSession(id: string, home?: string) {
  const row = getSession(id, home) as any;

  if (!row) {
    throw new Error(`Session not found: ${id}`);
  }

  return {
    session: row,
    resumeCommand: row.resume_command ?? row.resumeCommand,
    harness: row.harness,
  };
}

export function doctor(home = defaultHomePath()) {
  const issues: string[] = [];
  const warnings: string[] = [];

  if (!runtimeExists(home)) {
    issues.push('missing config');
  }

  if (issues.length) {
    return { ok: false, issues, warnings };
  }

  const { config, paths } = resolveRuntime(home);
  const managedPaths = [
    paths.workspaceRoot,
    paths.artifactRoot,
    paths.logRoot,
    paths.sessionRoot,
    paths.cacheRoot,
    paths.dbPath,
  ];

  for (const dir of managedPaths.slice(0, 5)) {
    if (!existsSync(dir)) {
      issues.push(`missing dir:${dir}`);
    }
  }

  if (config.guardrails.restrictToHome) {
    for (const candidate of managedPaths) {
      try {
        ensureWithinHome(home, candidate);
      } catch (error) {
        issues.push((error as Error).message);
      }
    }
  }

  const dbHealth = healthcheckCurrentDb(home);
  issues.push(...dbHealth.issues);
  warnings.push(...(dbHealth.warnings ?? []));

  return {
    ok: issues.length === 0,
    issues,
    warnings,
    database: describeCurrentDb(home),
    defaultHarness: config.defaultHarness,
    workspaceRoot: paths.workspaceRoot,
  };
}

export function status(home?: string) {
  const db = openDb(home);

  const summary = {
    openFeatures: (db.query("select count(*) as c from features where status not in ('completed','canceled')").get() as any).c,
    activeLoops: (db.query("select count(*) as c from features where loop_phase not in ('idle','done')").get() as any).c,
    activeRuns: (db.query("select count(*) as c from runs where status in ('queued','running')").get() as any).c,
    pendingTasks: (db.query("select count(*) as c from tasks where status in ('pending','ready','running')").get() as any).c,
    sessionHealth: (db.query("select count(*) as c from sessions where status='stale'").get() as any).c === 0 ? 'ok' : 'stale',
    workspaceLocks: (db.query("select count(*) as c from workspaces where status in ('locked','active','verifying')").get() as any).c,
    pendingReconciliation: (db.query("select count(*) as c from sessions where status='stale'").get() as any).c,
    activeFeatureIds: db.query("select id from features where status not in ('completed','canceled') order by created_at asc").all().map((row: any) => row.id),
    runningRunIds: db.query("select id from runs where status in ('queued','running') order by created_at asc").all().map((row: any) => row.id),
    activeSessionIds: db.query("select id from sessions where status='active' order by created_at asc").all().map((row: any) => row.id),
    lockedWorkspaceIds: db.query("select id from workspaces where status in ('locked','active','verifying') order by created_at asc").all().map((row: any) => row.id),
  };

  db.close();
  return summary;
}

export function reconcile(home?: string) {
  const db = openDb(home);
  const stale = db.query("select * from sessions where status='stale'").all() as any[];
  const repairedSessions: string[] = [];
  const releasedWorkspaces: string[] = [];
  const revivedTasks: string[] = [];

  for (const session of stale) {
    db.prepare("update sessions set status='failed', updated_at=? where id=?").run(now(), session.id);

    if (session.run_id) {
      const run = db.query('select * from runs where id=?').get(session.run_id) as any;
      db.prepare("update runs set status='failed', result_json=?, updated_at=? where id=? and status in ('queued','running')")
        .run(JSON.stringify({ reason: 'stale_session' }), now(), session.run_id);

      if (run?.task_id) {
        db.prepare("update tasks set status='ready', result_json=?, updated_at=? where id=? and status='running'")
          .run(JSON.stringify({ reason: 'reconcile_restart' }), now(), run.task_id);
        revivedTasks.push(run.task_id);
      }
    }

    repairedSessions.push(session.id);
  }

  const orphaned = db.query(
    "select * from workspaces where status in ('locked','active','verifying') and (session_id is null or session_id not in (select id from sessions where status='active'))"
  ).all() as any[];

  for (const workspace of orphaned) {
    db.prepare("update workspaces set status='released', updated_at=? where id=?").run(now(), workspace.id);
    releasedWorkspaces.push(workspace.id);
  }

  emitEvent(db, 'reconciliation.completed', 'system', 'senderos', {
    repairedSessions,
    releasedWorkspaces,
    revivedTasks,
  });

  db.close();

  return {
    repairedSessions,
    releasedWorkspaces,
    revivedTasks,
  };
}

export function schedulePlan(home?: string) {
  const { config } = resolveRuntime(home);

  return {
    jobName: 'senderos-loop-maintenance',
    command: 'senderos reconcile && senderos status && senderos loop tick <feature-id>',
    cadence: '*/15 * * * *',
    env: {
      SENDEROS_HOME: defaultHomePath(),
      SENDEROS_OUTPUT: config.output.format,
    },
    guardrails: [
      'Run only in the configured Senderos home',
      'Do not bypass workspace locks or reconciliation',
      'Treat Senderos JSON output as the source of truth',
    ],
    expectedOutputs: [
      'Reconciliation summary',
      'Current system status',
      'Optional loop advancement result',
    ],
    recovery: [
      'Run senderos reconcile',
      'Inspect senderos status',
      'Resume with senderos loop resume <feature-id>',
    ],
    hostAgentContract: {
      harness: config.defaultHarness,
      outputMode: 'json',
      hostResponsibleForScheduling: true,
    },
  };
}

export function updateConfigPath(path: string, value: any, home = defaultHomePath()) {
  const cfg = loadConfig(home);
  const parts = path.split('.');
  let current: any = cfg;

  for (let i = 0; i < parts.length - 1; i++) {
    current[parts[i]] ??= {};
    current = current[parts[i]];
  }

  current[parts[parts.length - 1]] = value;
  writeFileSync(configPathForHome(home), JSON.stringify(cfg, null, 2));

  return cfg;
}

export function getConfigPath(path: string, home = defaultHomePath()) {
  const cfg = loadConfig(home) as any;
  return path.split('.').reduce((acc: any, key: string) => acc?.[key], cfg);
}
