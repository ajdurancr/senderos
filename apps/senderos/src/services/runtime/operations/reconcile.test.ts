import { describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { approveFeature, createFeature } from '../index';
import { startLoop } from './loop';
import { reconcile } from './reconcile';
import { resolveRuntime } from '../../../config/runtime';
import { initHome } from '../../../../tests/helpers/runtime';

describe('runtime reconcile operation', () => {
  test('repairs stale sessions and releases workspaces', () => {
    const home = initHome();
    const feature = approveFeature(createFeature({ home, title: 'Reconcile target' }).id, home)!;
    const started: any = startLoop(feature.id, home);
    const db = new Database(resolveRuntime(home).paths.dbPath);
    db.query("update sessions set status='stale' where id = ?").run(started.session.id);
    db.query("update runs set status='running' where id = ?").run(started.run.id);
    db.query("update tasks set status='running' where id = ?").run(started.task.id);
    db.query("update workspaces set status='locked', session_id=? where id = ?").run(started.session.id, started.feature.currentWorkspaceId);
    const reconciled = reconcile(home);
    expect(reconciled.repairedSessions).toContain(started.session.id);
    expect(reconciled.releasedWorkspaces.length).toBeGreaterThan(0);
    expect(reconciled.revivedTasks.length).toBeGreaterThan(0);
    db.close();
  });
});
