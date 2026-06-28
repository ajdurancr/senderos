import { describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { existsSync, rmSync } from 'node:fs';

import {
  approveFeature,
  cancelRun,
  createFeature,
  doctor,
  getConfigPath,
  getFeature,
  listRuns,
  listSessions,
  reconcile,
  resumeSession,
  schedulePlan,
  showLoop,
  startLoop,
  status,
  tickLoop,
  updateConfigPath,
} from '../src/services/runtime';
import { resolveRuntime } from '../src/config/runtime';
import { initHome, tempHome } from './helpers/runtime';

describe('runtime operations', () => {
  test('reads and updates nested config paths', () => {
    const home = initHome();

    expect(getConfigPath('output.format', home)).toBe('json');
    const updated = updateConfigPath('output.format', 'text', home);
    expect(updated.output.format).toBe('text');
    expect(getConfigPath('output.format', home)).toBe('text');

    updateConfigPath('database.turso.url', 'libsql://shadow.example', home);
    expect(getConfigPath('database.turso.url', home)).toBe('libsql://shadow.example');
  });

  test('reports doctor failures for missing config and missing managed directories', () => {
    const missing = doctor(tempHome());
    expect(missing.ok).toBe(false);
    expect(missing.issues).toContain('missing config');

    const home = initHome();
    const logRoot = resolveRuntime(home).paths.logRoot;
    rmSync(logRoot, { recursive: true, force: true });
    const checked = doctor(home);
    expect(checked.ok).toBe(false);
    expect(checked.issues.some((issue) => issue === `missing dir:${logRoot}`)).toBe(true);
  });

  test('wraps loop operations, run/session listing, status reporting, scheduling, and reconciliation', () => {
    const home = initHome();
    const feature = approveFeature(createFeature({ home, title: 'Operations target' }).id, home)!;

    expect(() => startLoop('feature-missing', home)).toThrow('Feature not found: feature-missing');
    expect(() => startLoop(createFeature({ home, title: 'Not ready' }).id, home)).toThrow(
      'Feature is not dispatchable from status defined'
    );

    const started = startLoop(feature.id, home) as any;
    expect(showLoop(feature.id, home)).toMatchObject({
      feature: { id: feature.id },
      currentRun: { id: started.run.id },
      workspace: { id: started.feature.currentWorkspaceId },
    });

    const resumed = resumeSession(started.session.id, home);
    expect(resumed.resumeCommand).toBe(`senderos session resume ${started.session.id}`);
    expect(() => resumeSession('session-missing', home)).toThrow('Session not found: session-missing');

    expect(listRuns(home).map((run: any) => run.id)).toContain(started.run.id);
    expect(listSessions(home).map((session: any) => session.id)).toContain(started.session.id);

    const snapshot = status(home);
    expect(snapshot.openFeatures).toBeGreaterThan(0);
    expect(snapshot.activeLoops).toBe(1);
    expect(snapshot.activeRuns).toBe(1);
    expect(snapshot.pendingTasks).toBeGreaterThan(0);
    expect(snapshot.sessionHealth).toBe('ok');
    expect(snapshot.activeFeatureIds).toContain(feature.id);
    expect(snapshot.runningRunIds).toContain(started.run.id);
    expect(snapshot.activeSessionIds).toContain(started.session.id);
    expect(snapshot.lockedWorkspaceIds).toContain(started.feature.currentWorkspaceId);

    const canceled = cancelRun(started.run.id, home) as any;
    expect(canceled.status).toBe('canceled');
    expect(schedulePlan(home)).toEqual(
      expect.objectContaining({
        jobName: 'senderos-loop-maintenance',
        cadence: '*/15 * * * *',
        hostAgentContract: expect.objectContaining({
          hostResponsibleForScheduling: true,
        }),
      })
    );

    tickLoop(feature.id, home);
    expect(getFeature(feature.id, home)?.loopPhase).toBe('implementation');

    const reconcileFeature = approveFeature(
      createFeature({ home, title: 'Reconcile target' }).id,
      home
    )!;
    const reconcileStarted = startLoop(reconcileFeature.id, home) as any;

    const db = new Database(resolveRuntime(home).paths.dbPath);
    db.query("update sessions set status='stale' where id = ?").run(reconcileStarted.session.id);
    db.query("update runs set status='running' where id = ?").run(reconcileStarted.run.id);
    db.query("update tasks set status='running' where id = ?").run(reconcileStarted.task.id);
    db
      .query("update workspaces set status='locked', session_id=? where id = ?")
      .run(reconcileStarted.session.id, reconcileStarted.feature.currentWorkspaceId);
    const reconciled = reconcile(home);
    expect(reconciled.repairedSessions).toContain(reconcileStarted.session.id);
    expect(reconciled.releasedWorkspaces.length).toBeGreaterThan(0);
    expect(reconciled.revivedTasks.length).toBeGreaterThan(0);
    db.close();

    expect(existsSync(resolveRuntime(home).paths.configPath)).toBe(true);
  });
});
