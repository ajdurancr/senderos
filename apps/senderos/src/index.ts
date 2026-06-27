import { mkdirSync, existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve, relative } from 'node:path';
import { Database } from 'bun:sqlite';

export type DatabaseKind = 'local' | 'turso';
export type FeatureStatus = 'defined' | 'ready' | 'active' | 'verifying' | 'completed' | 'failed' | 'canceled';
export type LoopPhase = 'idle' | 'contract' | 'implementation' | 'review' | 'mutation' | 'done' | 'blocked';
export type RunStatus = 'queued' | 'running' | 'completed' | 'failed' | 'canceled';
export type SessionStatus = 'active' | 'stale' | 'completed' | 'failed';
export type WorkspaceStatus = 'allocated' | 'locked' | 'active' | 'verifying' | 'released' | 'cleaned' | 'retained';

export interface SenderosConfig {
  database: { kind: DatabaseKind; path?: string; turso?: { url: string; authTokenEnv: string } };
  workspaceRoot: string;
  artifactRoot: string;
  logRoot: string;
  sessionRoot: string;
  cacheRoot: string;
  defaultHarness: string;
  output: { format: 'json' | 'text' };
  guardrails: { restrictToHome: boolean };
}

export interface RuntimePaths {
  home: string;
  configPath: string;
  dbPath: string;
  workspaceRoot: string;
  artifactRoot: string;
  logRoot: string;
  sessionRoot: string;
  cacheRoot: string;
}

export interface FeatureRecord {
  id: string;
  title: string;
  problemStatement: string;
  contractText: string;
  status: FeatureStatus;
  loopPhase: LoopPhase;
  completionCriteria: string;
  currentWorkspaceId: string | null;
  currentRunId: string | null;
  createdAt: string;
  updatedAt: string;
}

function mapFeatureRow(row: any): FeatureRecord | null {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    problemStatement: row.problem_statement,
    contractText: row.contract_text,
    status: row.status,
    loopPhase: row.loop_phase,
    completionCriteria: row.completion_criteria,
    currentWorkspaceId: row.current_workspace_id,
    currentRunId: row.current_run_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function now() { return new Date().toISOString(); }
function randomId(prefix: string) { return `${prefix}-${Math.random().toString(36).slice(2, 10)}`; }

export function defaultHomePath() { return resolve(process.env.SENDEROS_HOME ?? join(process.env.HOME ?? process.cwd(), '.senderos')); }
export function defaultConfigForHome(home: string): SenderosConfig {
  return {
    database: { kind: 'local', path: join(home, 'senderos.db') },
    workspaceRoot: join(home, 'workspaces'),
    artifactRoot: join(home, 'artifacts'),
    logRoot: join(home, 'logs'),
    sessionRoot: join(home, 'sessions'),
    cacheRoot: join(home, 'cache'),
    defaultHarness: 'openclaw',
    output: { format: 'json' },
    guardrails: { restrictToHome: true },
  };
}

export function configPathForHome(home: string) { return join(home, 'config.json'); }
export function loadConfig(home = defaultHomePath()): SenderosConfig {
  return JSON.parse(readFileSync(configPathForHome(home), 'utf8')) as SenderosConfig;
}

function ensureWithinHome(home: string, target: string) {
  const rel = relative(home, target);
  if (rel.startsWith('..') || rel === '' && !target.startsWith(home)) {
    throw new Error(`Guardrail violation: path outside Senderos home: ${target}`);
  }
}

function ensureDir(path: string) { mkdirSync(path, { recursive: true }); }

export function initializeRuntime(home = defaultHomePath(), config?: Partial<SenderosConfig>) {
  const runtimeConfig = { ...defaultConfigForHome(home), ...config } as SenderosConfig;
  ensureDir(home);
  const dirs = [runtimeConfig.workspaceRoot, runtimeConfig.artifactRoot, runtimeConfig.logRoot, runtimeConfig.sessionRoot, runtimeConfig.cacheRoot];
  for (const dir of dirs) {
    if (!isAbsolute(dir)) throw new Error(`Path must be absolute: ${dir}`);
    if (runtimeConfig.guardrails.restrictToHome) ensureWithinHome(home, dir);
    ensureDir(dir);
  }
  writeFileSync(configPathForHome(home), JSON.stringify(runtimeConfig, null, 2));
  if (runtimeConfig.database.kind === 'local') {
    const dbPath = runtimeConfig.database.path ?? join(home, 'senderos.db');
    if (runtimeConfig.guardrails.restrictToHome) ensureWithinHome(home, dbPath);
    const db = new Database(dbPath);
    migrate(db);
    db.close();
  }
  return { home, configPath: configPathForHome(home) };
}

export function resolveRuntime(home = defaultHomePath()) {
  const config = loadConfig(home);
  const dbPath = config.database.kind === 'local' ? (config.database.path ?? join(home, 'senderos.db')) : join(home, 'senderos.db');
  return {
    config,
    paths: {
      home,
      configPath: configPathForHome(home),
      dbPath,
      workspaceRoot: config.workspaceRoot,
      artifactRoot: config.artifactRoot,
      logRoot: config.logRoot,
      sessionRoot: config.sessionRoot,
      cacheRoot: config.cacheRoot,
    } satisfies RuntimePaths,
  };
}

function openDb(home = defaultHomePath()) {
  const { config } = resolveRuntime(home);
  if (config.database.kind !== 'local') throw new Error('Turso mode is configuration-supported but not executable in this local runtime yet.');
  const db = new Database(config.database.path!);
  migrate(db);
  return db;
}

function migrate(db: Database) {
  db.exec(`
    create table if not exists features (
      id text primary key,
      title text not null,
      problem_statement text not null default '',
      contract_text text not null default '',
      status text not null,
      loop_phase text not null,
      completion_criteria text not null default '',
      current_workspace_id text,
      current_run_id text,
      created_at text not null,
      updated_at text not null
    );
    create table if not exists tasks (
      id text primary key,
      feature_id text not null,
      name text not null,
      status text not null,
      payload_json text not null,
      created_at text not null,
      updated_at text not null
    );
    create table if not exists runs (
      id text primary key,
      feature_id text not null,
      task_id text,
      phase text not null,
      status text not null,
      instruction_json text not null,
      result_json text not null default '{}',
      created_at text not null,
      updated_at text not null
    );
    create table if not exists sessions (
      id text primary key,
      run_id text,
      harness text not null,
      external_session_id text,
      status text not null,
      status_snapshot_json text not null default '{}',
      heartbeat_at text,
      resume_command text,
      created_at text not null,
      updated_at text not null
    );
    create table if not exists workspaces (
      id text primary key,
      feature_id text,
      run_id text,
      session_id text,
      root_path text not null,
      status text not null,
      branch_name text,
      retention_reason text,
      created_at text not null,
      updated_at text not null
    );
    create table if not exists events (
      id text primary key,
      event_type text not null,
      entity_type text not null,
      entity_id text not null,
      payload_json text not null,
      created_at text not null
    );
  `);
}

function emitEvent(db: Database, eventType: string, entityType: string, entityId: string, payload: unknown) {
  db.prepare('insert into events (id,event_type,entity_type,entity_id,payload_json,created_at) values (?,?,?,?,?,?)')
    .run(randomId('event'), eventType, entityType, entityId, JSON.stringify(payload ?? {}), now());
}

export function createFeature(input: { home?: string; title: string; problemStatement?: string; contractText?: string; completionCriteria?: string; id?: string }) {
  const db = openDb(input.home);
  const ts = now();
  const id = input.id ?? randomId('feature');
  db.prepare(`insert into features (id,title,problem_statement,contract_text,status,loop_phase,completion_criteria,current_workspace_id,current_run_id,created_at,updated_at)
    values (?,?,?,?,?,?,?,?,?,?,?)`).run(id, input.title, input.problemStatement ?? '', input.contractText ?? '', 'defined', 'idle', input.completionCriteria ?? '', null, null, ts, ts);
  emitEvent(db, 'feature.created', 'feature', id, { title: input.title });
  const feature = getFeature(id, input.home)!;
  db.close();
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
  db.prepare('update features set status=?, updated_at=? where id=?').run('ready', now(), id);
  emitEvent(db, 'feature.approved', 'feature', id, {});
  db.close();
  return getFeature(id, home);
}

export function cancelFeature(id: string, home?: string) {
  const db = openDb(home);
  db.prepare('update features set status=?, updated_at=? where id=?').run('canceled', now(), id);
  emitEvent(db, 'feature.canceled', 'feature', id, {});
  db.close();
  return getFeature(id, home);
}

function allocateWorkspace(featureId: string, home?: string) {
  const { paths } = resolveRuntime(home);
  const id = randomId('workspace');
  const rootPath = join(paths.workspaceRoot, featureId);
  ensureDir(rootPath);
  const db = openDb(home);
  db.prepare('insert into workspaces (id,feature_id,run_id,session_id,root_path,status,branch_name,retention_reason,created_at,updated_at) values (?,?,?,?,?,?,?,?,?,?)')
    .run(id, featureId, null, null, rootPath, 'allocated', null, null, now(), now());
  emitEvent(db, 'workspace.allocated', 'workspace', id, { featureId, rootPath });
  db.close();
  return { id, rootPath };
}

function createRunRecord(featureId: string, phase: LoopPhase, instruction: unknown, home?: string) {
  const db = openDb(home);
  const id = randomId('run');
  db.prepare('insert into runs (id,feature_id,task_id,phase,status,instruction_json,result_json,created_at,updated_at) values (?,?,?,?,?,?,?,?,?)')
    .run(id, featureId, null, phase, 'queued', JSON.stringify(instruction), '{}', now(), now());
  emitEvent(db, 'run.created', 'run', id, { featureId, phase });
  db.close();
  return id;
}

function createSession(runId: string, harness: string, resumeCommand: string, home?: string) {
  const db = openDb(home);
  const id = randomId('session');
  db.prepare('insert into sessions (id,run_id,harness,external_session_id,status,status_snapshot_json,heartbeat_at,resume_command,created_at,updated_at) values (?,?,?,?,?,?,?,?,?,?)')
    .run(id, runId, harness, null, 'active', '{}', now(), resumeCommand, now(), now());
  emitEvent(db, 'session.created', 'session', id, { runId, harness });
  db.close();
  return id;
}

export function startLoop(featureId: string, home?: string) {
  const feature = getFeature(featureId, home);
  if (!feature) throw new Error(`Feature not found: ${featureId}`);
  if (!['ready', 'active', 'failed'].includes(feature.status)) throw new Error(`Feature is not dispatchable from status ${feature.status}`);
  const workspace = feature.currentWorkspaceId ? null : allocateWorkspace(featureId, home);
  const instruction = { action: 'implement feature loop', featureId, nextPhase: 'implementation' };
  const runId = createRunRecord(featureId, 'implementation', instruction, home);
  const { config } = resolveRuntime(home);
  const sessionId = createSession(runId, config.defaultHarness, `senderos session resume ${runId}`, home);
  const db = openDb(home);
  db.prepare('update workspaces set run_id=?, session_id=?, status=?, updated_at=? where feature_id=? and status in (?,?,?)')
    .run(runId, sessionId, 'locked', now(), featureId, 'allocated', 'released', 'retained');
  const workspaceId = (db.query('select id from workspaces where feature_id=? order by created_at desc limit 1').get(featureId) as {id:string}|null)?.id ?? null;
  db.prepare('update features set status=?, loop_phase=?, current_workspace_id=?, current_run_id=?, updated_at=? where id=?')
    .run('active', 'implementation', workspaceId, runId, now(), featureId);
  emitEvent(db, 'feature.loop_started', 'feature', featureId, { runId, sessionId, workspaceId });
  db.close();
  return { feature: getFeature(featureId, home), run: getRun(runId, home), session: getSession(sessionId, home) };
}

export function tickLoop(featureId: string, home?: string) {
  const feature = getFeature(featureId, home);
  if (!feature) throw new Error(`Feature not found: ${featureId}`);
  const transitions: Record<LoopPhase, LoopPhase> = { idle: 'implementation', contract: 'implementation', implementation: 'review', review: 'mutation', mutation: 'done', done: 'done', blocked: 'implementation' };
  const next = transitions[feature.loopPhase];
  const status: FeatureStatus = next === 'done' ? 'completed' : next === 'mutation' || next === 'review' ? 'verifying' : 'active';
  const db = openDb(home);
  let runId = feature.currentRunId;
  if (next !== 'done') runId = createRunRecord(featureId, next, { action: `advance to ${next}`, featureId }, home);
  db.prepare('update features set loop_phase=?, status=?, current_run_id=?, updated_at=? where id=?').run(next, status, runId, now(), featureId);
  if (feature.currentWorkspaceId && next === 'done') db.prepare('update workspaces set status=?, updated_at=? where id=?').run('released', now(), feature.currentWorkspaceId);
  emitEvent(db, 'feature.loop_ticked', 'feature', featureId, { next });
  db.close();
  return { feature: getFeature(featureId, home), run: runId ? getRun(runId, home) : null };
}

export function showLoop(featureId: string, home?: string) {
  const feature = getFeature(featureId, home);
  if (!feature) throw new Error(`Feature not found: ${featureId}`);
  return {
    feature,
    currentRun: feature.currentRunId ? getRun(feature.currentRunId, home) : null,
    workspace: feature.currentWorkspaceId ? getWorkspace(feature.currentWorkspaceId, home) : null,
  };
}

export function listRuns(home?: string) { const db = openDb(home); const rows = db.query('select * from runs order by created_at asc').all(); db.close(); return rows; }
export function getRun(id: string, home?: string) { const db = openDb(home); const row = db.query('select * from runs where id=?').get(id); db.close(); return row; }
export function cancelRun(id: string, home?: string) { const db = openDb(home); db.prepare('update runs set status=?, updated_at=? where id=?').run('canceled', now(), id); emitEvent(db, 'run.canceled', 'run', id, {}); db.close(); return getRun(id, home); }
export function listSessions(home?: string) { const db = openDb(home); const rows = db.query('select * from sessions order by created_at asc').all(); db.close(); return rows; }
export function getSession(id: string, home?: string) { const db = openDb(home); const row = db.query('select * from sessions where id=?').get(id); db.close(); return row; }
export function resumeSession(id: string, home?: string) { const row = getSession(id, home) as any; if (!row) throw new Error(`Session not found: ${id}`); return { session: row, resumeCommand: row.resume_command ?? row.resumeCommand }; }
export function getWorkspace(id: string, home?: string) { const db = openDb(home); const row = db.query('select * from workspaces where id=?').get(id); db.close(); return row; }

export function doctor(home = defaultHomePath()) {
  const issues: string[] = [];
  if (!existsSync(configPathForHome(home))) issues.push('missing config');
  if (issues.length) return { ok: false, issues };
  const { config, paths } = resolveRuntime(home);
  const dirs = [paths.workspaceRoot, paths.artifactRoot, paths.logRoot, paths.sessionRoot, paths.cacheRoot];
  for (const dir of dirs) if (!existsSync(dir)) issues.push(`missing dir:${dir}`);
  if (config.database.kind === 'local') {
    try { const db = openDb(home); db.close(); } catch (error) { issues.push(`db:${(error as Error).message}`); }
  } else {
    if (!config.database.turso?.url) issues.push('missing turso url');
    if (!config.database.turso?.authTokenEnv) issues.push('missing turso authTokenEnv');
  }
  return { ok: issues.length === 0, issues, databaseKind: config.database.kind, defaultHarness: config.defaultHarness };
}

export function status(home?: string) {
  const db = openDb(home);
  const summary = {
    openFeatures: (db.query("select count(*) as c from features where status not in ('completed','canceled')").get() as any).c,
    activeLoops: (db.query("select count(*) as c from features where loop_phase not in ('idle','done')").get() as any).c,
    activeRuns: (db.query("select count(*) as c from runs where status in ('queued','running')").get() as any).c,
    sessionHealth: (db.query("select count(*) as c from sessions where status='stale'").get() as any).c === 0 ? 'ok' : 'stale',
    workspaceLocks: (db.query("select count(*) as c from workspaces where status in ('locked','active','verifying')").get() as any).c,
    pendingReconciliation: (db.query("select count(*) as c from sessions where status='stale'").get() as any).c,
  };
  db.close();
  return summary;
}

export function reconcile(home?: string) {
  const db = openDb(home);
  const stale = db.query("select * from sessions where status='stale'").all() as any[];
  const repaired: string[] = [];
  for (const session of stale) {
    db.prepare("update sessions set status='failed', updated_at=? where id=?").run(now(), session.id);
    if (session.run_id) db.prepare("update runs set status='failed', updated_at=? where id=? and status in ('queued','running')").run(now(), session.run_id);
    repaired.push(session.id);
  }
  const orphaned = db.query("select * from workspaces where status='locked' and (session_id is null or session_id not in (select id from sessions where status='active'))").all() as any[];
  const released: string[] = [];
  for (const workspace of orphaned) {
    db.prepare("update workspaces set status='released', updated_at=? where id=?").run(now(), workspace.id);
    released.push(workspace.id);
  }
  emitEvent(db, 'reconciliation.completed', 'system', 'senderos', { repaired, released });
  db.close();
  return { repairedSessions: repaired, releasedWorkspaces: released };
}

export function schedulePlan(home?: string) {
  const { config } = resolveRuntime(home);
  return {
    command: 'senderos reconcile && senderos loop tick <feature-id>',
    cadence: '*/15 * * * *',
    env: { SENDEROS_HOME: defaultHomePath() },
    guardrails: ['Run only in the configured Senderos home', 'Do not bypass workspace locks or reconciliation'],
    outputs: ['Machine-readable JSON status', 'Reconciliation events'],
    recovery: ['Run senderos reconcile', 'Resume with senderos loop resume <feature-id>'],
    harness: config.defaultHarness,
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
function parseArgs(argv: string[]) {
  const positionals: string[] = []; const options: Record<string,string|boolean> = {};
  for (let i=0;i<argv.length;i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i+1];
      if (!next || next.startsWith('--')) options[key] = true;
      else { options[key]=next; i++; }
    } else positionals.push(arg);
  }
  return { positionals, options };
}

export async function runCli(argv = process.argv.slice(2)) {
  const { positionals, options } = parseArgs(argv);
  const home = resolve(String(options.home ?? defaultHomePath()));
  const cmd = positionals[0]; const sub = positionals[1];
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
        else if (sub === 'update') result = updateFeature({ home, id: positionals[2], title: options.title as string|undefined, problemStatement: options['problem-statement'] as string|undefined, contractText: options.contract as string|undefined, completionCriteria: options['completion-criteria'] as string|undefined });
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

if (import.meta.main) await runCli();
