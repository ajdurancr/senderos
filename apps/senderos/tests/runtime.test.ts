import { afterEach, describe, expect, test } from 'bun:test';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { Database } from 'bun:sqlite';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  approveFeature,
  cancelRun,
  createFeature,
  doctor,
  initializeRuntime,
  listFeatures,
  listRuns,
  listTasks,
  loadConfig,
  reconcile,
  resolveRuntime,
  schedulePlan,
  showLoop,
  startLoop,
  status,
  tickLoop,
  runCli,
} from '../src/index';

const homes: string[] = [];
function tempHome() { const dir = mkdtempSync(join(tmpdir(), 'senderos-test-')); homes.push(dir); return dir; }
afterEach(() => { while (homes.length) rmSync(homes.pop()!, { recursive: true, force: true }); });

describe('runtime init', () => {
  test('creates home, config, and database', () => {
    const home = tempHome();
    initializeRuntime(home);
    const { paths } = resolveRuntime(home);
    expect(existsSync(paths.configPath)).toBe(true);
    expect(existsSync(paths.dbPath)).toBe(true);
    expect(doctor(home).ok).toBe(true);
  });

  test('enforces guardrails for paths outside home', () => {
    const home = tempHome();
    expect(() => initializeRuntime(home, { workspaceRoot: '/tmp/not-allowed' } as any)).toThrow();
  });
});

describe('feature lifecycle', () => {
  test('creates, updates, approves, and starts loop', () => {
    const home = tempHome();
    initializeRuntime(home);
    const created = createFeature({ home, title: 'Add billing portal', problemStatement: 'Users need billing', contractText: 'Given...', completionCriteria: 'Deployable' });
    expect(created.status).toBe('defined');
    expect(listFeatures(home)).toHaveLength(1);
    const approved = approveFeature(created.id, home);
    expect(approved?.status).toBe('ready');
    const started = startLoop(created.id, home);
    expect(started.feature?.status).toBe('ready');
    expect(started.feature?.loopPhase).toBe('contract');
    expect(started.task?.phase).toBe('contract');
    expect(listTasks(created.id, home).length).toBeGreaterThan(0);
    expect(status(home).activeLoops).toBe(1);
  });

  test('ticks through loop and releases workspace at done', () => {
    const home = tempHome();
    initializeRuntime(home);
    const feature = approveFeature(createFeature({ home, title: 'Ship it' }).id, home)!;
    startLoop(feature.id, home);
    expect(tickLoop(feature.id, home).feature?.loopPhase).toBe('implementation');
    expect(tickLoop(feature.id, home).feature?.loopPhase).toBe('review');
    expect(tickLoop(feature.id, home).feature?.loopPhase).toBe('mutation');
    const done = tickLoop(feature.id, home).feature;
    expect(done?.loopPhase).toBe('done');
    expect(done?.status).toBe('completed');
  });
});

describe('run and reconcile behavior', () => {
  test('can cancel a run and emit scheduling plan', () => {
    const home = tempHome();
    initializeRuntime(home);
    const feature = approveFeature(createFeature({ home, title: 'Run test' }).id, home)!;
    const started = startLoop(feature.id, home) as any;
    const run = cancelRun(started.run.id, home) as any;
    expect(run.status).toBe('canceled');
    expect(schedulePlan(home).command).toContain('senderos reconcile');
    expect(schedulePlan(home).hostAgentContract.hostResponsibleForScheduling).toBe(true);
    expect(listRuns(home).length).toBeGreaterThan(0);
  });

  test('releases stale-session workspaces', () => {
    const home = tempHome();
    initializeRuntime(home);
    const feature = approveFeature(createFeature({ home, title: 'Reconcile me' }).id, home)!;
    const started = startLoop(feature.id, home) as any;
    const dbPath = resolveRuntime(home).paths.dbPath;
    const db = new Database(dbPath);
    db.query("update sessions set status='stale' where id = ?").run(started.session.id);
    const result = reconcile(home);
    expect(result.repairedSessions).toContain(started.session.id);
    expect(result.releasedWorkspaces.length).toBeGreaterThan(0);
    expect(result.revivedTasks.length).toBeGreaterThan(0);
    db.close();
  });
});

describe('loop visibility', () => {
  test('showLoop exposes tasks and next dispatch instruction', () => {
    const home = tempHome();
    initializeRuntime(home);
    const feature = approveFeature(createFeature({ home, title: 'Visible loop' }).id, home)!;
    startLoop(feature.id, home);
    const shown = showLoop(feature.id, home);
    expect(shown.tasks.length).toBeGreaterThan(0);
    expect(shown.nextDispatch.phase).toBe('contract');
  });
});

describe('cli and config', () => {
  test('config set/get and CLI init work', async () => {
    const home = tempHome();
    await runCli(['init', '--home', home]);
    await runCli(['config', 'set', 'defaultHarness', 'codex', '--home', home]);
    const config = loadConfig(home);
    expect(config.defaultHarness).toBe('codex');
    expect(readFileSync(join(home, 'config.json'), 'utf8')).toContain('codex');
  });
});
