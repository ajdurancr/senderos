import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { configPathForHome, defaultHomePath, ensureWithinHome, initializeRuntime, loadConfig, resolveRuntime, runtimeExists } from '../config/runtime';
import type { FeatureRecord } from '../domain/types';
import { openDb } from '../db/client';
import { mapFeatureRow } from '../db/mappers';
import { now, randomId } from '../utils/common';
import { emitEvent } from './events';
import { ensurePhaseTask, getRun, getSession, getTask, getWorkspace, listTasks, startLoopForFeature, tickLoopForFeature } from './loop';

export { defaultHomePath, initializeRuntime, loadConfig, resolveRuntime };

export function createFeature(input: { home?: string; title: string; problemStatement?: string; contractText?: string; completionCriteria?: string; id?: string }) {
  const db = openDb(input.home);
  const ts = now();
  const id = input.id ?? randomId('feature');
  db.prepare(`insert into features (id,title,problem_statement,contract_text,status,loop_phase,completion_criteria,current_workspace_id,current_run_id,created_at,updated_at)
    values (?,?,?,?,?,?,?,?,?,?,?)`).run(id, input.title, input.problemStatement ?? '', input.contractText ?? '', 'defined', 'idle', input.completionCriteria ?? '', null, null, ts, ts);
  emitEvent(db, 'feature.created', 'feature', id, { title: input.title });
  db.close();
  const feature = getFeature(id, input.home)!;
  ensurePhaseTask(feature, 'contract', input.home);
  return feature;
}

export function listFeatures(home?: string): FeatureRecord[] {
  const db = openDb(home);
  const rows = db.query('select * from features order by created_at asc').all().map(mapFeatureRow) as FeatureRecord[];
  db.close();
  return rows;
}

export function getFeature(id: string, home?: string): FeatureRecord | null {
  const db = openDb(home);
  const row = mapFeatureRow(db.query('select * from features where id = ?').get(id));
  db.close();
  return row;
}

export function updateFeature(input: { home?: string; id: string; title?: string; problemStatement?: string; contractText?: string; completionCriteria?: string }) {
  const current = getFeature(input.id, input.home);
  if (!current) throw new Error(`Feature not found: ${input.id}`);
  const db = openDb(input.home);
  db.prepare('update features set title=?, problem_statement=?, contract_text=?, completion_criteria=?, updated_at=? where id=?')
    .run(input.title ?? current.title, input.problemStatement ?? current.problemStatement, input.contractText ?? current.contractText, input.completionCriteria ?? current.completionCriteria, now(), input.id);
  emitEvent(db, 'feature.updated', 'feature', input.id, input);
  db.close();
  return getFeature(input.id, input.home);
}

export function approveFeature(id: string, home?: string) {
  const current = getFeature(id, home);
  if (!current) throw new Error(`Feature not found: ${id}`);
  const db = openDb(home);
  db.prepare('update features set status=?, loop_phase=?, updated_at=? where id=?').run('ready', 'contract', now(), id);
  emitEvent(db, 'feature.approved', 'feature', id, {});
  db.close();
  ensurePhaseTask(getFeature(id, home)!, 'contract', home);
  return getFeature(id, home);
}

export function cancelFeature(id: string, home?: string) {
  const db = openDb(home);
  db.prepare('update features set status=?, updated_at=? where id=?').run('canceled', now(), id);
  db.prepare("update tasks set status='canceled', updated_at=? where feature_id=? and status not in ('completed','failed')").run(now(), id);
  emitEvent(db, 'feature.canceled', 'feature', id, {});
  db.close();
  return getFeature(id, home);
}

export function startLoop(featureId: string, home?: string) {
  const feature = getFeature(featureId, home);
  if (!feature) throw new Error(`Feature not found: ${featureId}`);
  if (!['ready', 'active', 'failed'].includes(feature.status)) throw new Error(`Feature is not dispatchable from status ${feature.status}`);
  const result = startLoopForFeature(feature, home);
  return { feature: getFeature(feature.id, home), run: result.run, session: result.session, task: result.task };
}

export function tickLoop(featureId: string, home?: string) {
  const feature = getFeature(featureId, home);
  if (!feature) throw new Error(`Feature not found: ${featureId}`);
  const result = tickLoopForFeature(feature, home);
  return { feature: getFeature(feature.id, home), run: result.run, task: result.task };
}

export function showLoop(featureId: string, home?: string) {
  const feature = getFeature(featureId, home);
  if (!feature) throw new Error(`Feature not found: ${featureId}`);
  const tasks = listTasks(featureId, home);
  const pendingTask = tasks.find((task) => ['ready', 'running', 'pending'].includes(task.status));
  return {
    feature,
    tasks,
    currentRun: feature.currentRunId ? getRun(feature.currentRunId, home) : null,
    workspace: feature.currentWorkspaceId ? getWorkspace(feature.currentWorkspaceId, home) : null,
    nextDispatch: pendingTask ? JSON.parse(pendingTask.instructionJson) : null,
  };
}

export function listRuns(home?: string) { const db = openDb(home); const rows = db.query('select * from runs order by created_at asc').all(); db.close(); return rows; }
export function cancelRun(id: string, home?: string) {
  const db = openDb(home);
  const run = db.query('select * from runs where id=?').get(id) as any;
  if (!run) { db.close(); throw new Error(`Run not found: ${id}`); }
  db.prepare('update runs set status=?, updated_at=? where id=?').run('canceled', now(), id);
  if (run.task_id) db.prepare('update tasks set status=?, updated_at=? where id=?').run('canceled', now(), run.task_id);
  emitEvent(db, 'run.canceled', 'run', id, {});
  db.close();
  return getRun(id, home);
}
export function listSessions(home?: string) { const db = openDb(home); const rows = db.query('select * from sessions order by created_at asc').all(); db.close(); return rows; }
export function resumeSession(id: string, home?: string) { const row = getSession(id, home) as any; if (!row) throw new Error(`Session not found: ${id}`); return { session: row, resumeCommand: row.resume_command ?? row.resumeCommand, harness: row.harness }; }

export function doctor(home = defaultHomePath()) {
  const issues: string[] = [];
  const warnings: string[] = [];
  if (!runtimeExists(home)) issues.push('missing config');
  if (issues.length) return { ok: false, issues, warnings };
  const { config, paths } = resolveRuntime(home);
  for (const dir of [paths.workspaceRoot, paths.artifactRoot, paths.logRoot, paths.sessionRoot, paths.cacheRoot]) if (!existsSync(dir)) issues.push(`missing dir:${dir}`);
  if (config.guardrails.restrictToHome) {
    for (const candidate of [paths.workspaceRoot, paths.artifactRoot, paths.logRoot, paths.sessionRoot, paths.cacheRoot, paths.dbPath]) {
      try { ensureWithinHome(home, candidate); } catch (error) { issues.push((error as Error).message); }
    }
  }
  if (config.database.kind === 'local') {
    try { const db = openDb(home); db.close(); } catch (error) { issues.push(`db:${(error as Error).message}`); }
  } else {
    if (!config.database.turso?.url) issues.push('missing turso url');
    if (!config.database.turso?.authTokenEnv) issues.push('missing turso authTokenEnv');
    if (config.database.turso?.authTokenEnv && !process.env[config.database.turso.authTokenEnv]) warnings.push(`env:${config.database.turso.authTokenEnv} is not set in this shell`);
    warnings.push('turso mode requires an async libsql-backed runtime path; current local CLI path validates configuration shape only');
  }
  return { ok: issues.length === 0, issues, warnings, databaseKind: config.database.kind, defaultHarness: config.defaultHarness, workspaceRoot: paths.workspaceRoot };
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
      db.prepare("update runs set status='failed', result_json=?, updated_at=? where id=? and status in ('queued','running')").run(JSON.stringify({ reason: 'stale_session' }), now(), session.run_id);
      if (run?.task_id) {
        db.prepare("update tasks set status='ready', result_json=?, updated_at=? where id=? and status='running'").run(JSON.stringify({ reason: 'reconcile_restart' }), now(), run.task_id);
        revivedTasks.push(run.task_id);
      }
    }
    repairedSessions.push(session.id);
  }
  const orphaned = db.query("select * from workspaces where status in ('locked','active','verifying') and (session_id is null or session_id not in (select id from sessions where status='active'))").all() as any[];
  for (const workspace of orphaned) {
    db.prepare("update workspaces set status='released', updated_at=? where id=?").run(now(), workspace.id);
    releasedWorkspaces.push(workspace.id);
  }
  emitEvent(db, 'reconciliation.completed', 'system', 'senderos', { repairedSessions, releasedWorkspaces, revivedTasks });
  db.close();
  return { repairedSessions, releasedWorkspaces, revivedTasks };
}

export function schedulePlan(home?: string) {
  const { config } = resolveRuntime(home);
  return {
    jobName: 'senderos-loop-maintenance',
    command: 'senderos reconcile && senderos status && senderos loop tick <feature-id>',
    cadence: '*/15 * * * *',
    env: { SENDEROS_HOME: defaultHomePath(), SENDEROS_OUTPUT: config.output.format },
    guardrails: ['Run only in the configured Senderos home', 'Do not bypass workspace locks or reconciliation', 'Treat Senderos JSON output as the source of truth'],
    expectedOutputs: ['Reconciliation summary', 'Current system status', 'Optional loop advancement result'],
    recovery: ['Run senderos reconcile', 'Inspect senderos status', 'Resume with senderos loop resume <feature-id>'],
    hostAgentContract: {
      harness: config.defaultHarness,
      outputMode: 'json',
      hostResponsibleForScheduling: true,
    },
  };
}

function parseValue(raw: string): any {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (/^-?\d+$/.test(raw)) return Number(raw);
  return raw;
}
function getByPath(obj: any, path: string) { return path.split('.').reduce((acc, key) => acc?.[key], obj); }
function setByPath(obj: any, path: string, value: any) {
  const parts = path.split('.'); let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) { cur[parts[i]] ??= {}; cur = cur[parts[i]]; }
  cur[parts[parts.length - 1]] = value;
}

export async function runCli(argv = process.argv.slice(2)) {
  const positionals: string[] = [];
  const options: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) options[key] = true;
      else { options[key] = next; i++; }
    } else positionals.push(arg);
  }
  const home = resolve(String(options.home ?? defaultHomePath()));
  const cmd = positionals[0];
  const sub = positionals[1];
  try {
    let result: unknown;
    switch (cmd) {
      case 'init': result = initializeRuntime(home); break;
      case 'doctor': result = doctor(home); break;
      case 'config':
        if (sub === 'show') result = loadConfig(home);
        else if (sub === 'get') result = { path: positionals[2], value: getByPath(loadConfig(home), positionals[2]) };
        else if (sub === 'set') { const cfg = loadConfig(home); setByPath(cfg, positionals[2], parseValue(String(positionals[3]))); writeFileSync(configPathForHome(home), JSON.stringify(cfg, null, 2)); result = cfg; }
        else throw new Error('Unknown config action');
        break;
      case 'feature':
        if (sub === 'create') result = createFeature({ home, title: String(options.title ?? ''), problemStatement: String(options['problem-statement'] ?? ''), contractText: String(options.contract ?? ''), completionCriteria: String(options['completion-criteria'] ?? '') });
        else if (sub === 'list') result = listFeatures(home);
        else if (sub === 'show') result = getFeature(positionals[2], home);
        else if (sub === 'update') result = updateFeature({ home, id: positionals[2], title: options.title as string | undefined, problemStatement: options['problem-statement'] as string | undefined, contractText: options.contract as string | undefined, completionCriteria: options['completion-criteria'] as string | undefined });
        else if (sub === 'approve') result = approveFeature(positionals[2], home);
        else if (sub === 'cancel') result = cancelFeature(positionals[2], home);
        else throw new Error('Unknown feature action');
        break;
      case 'loop':
        if (sub === 'start' || sub === 'resume') result = startLoop(positionals[2], home);
        else if (sub === 'tick') result = tickLoop(positionals[2], home);
        else if (sub === 'show') result = showLoop(positionals[2], home);
        else throw new Error('Unknown loop action');
        break;
      case 'run':
        if (sub === 'list') result = listRuns(home);
        else if (sub === 'show') result = getRun(positionals[2], home);
        else if (sub === 'cancel') result = cancelRun(positionals[2], home);
        else throw new Error('Unknown run action');
        break;
      case 'session':
        if (sub === 'list') result = listSessions(home);
        else if (sub === 'show') result = getSession(positionals[2], home);
        else if (sub === 'resume') result = resumeSession(positionals[2], home);
        else throw new Error('Unknown session action');
        break;
      case 'status': result = status(home); break;
      case 'reconcile': result = reconcile(home); break;
      case 'schedule-plan': result = schedulePlan(home); break;
      default: throw new Error(`Unknown command: ${cmd}`);
    }
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(JSON.stringify({ error: (error as Error).message }, null, 2));
    process.exitCode = 1;
  }
}
