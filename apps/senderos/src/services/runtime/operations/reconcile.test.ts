import { describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { approveFeature, createFeature } from '../index';
import { startLoop } from './runs-lifecycle';
import { reconcile } from './reconcile';
import { resolveRuntime } from '../../../config/runtime';
import { createProjectFixture, initHome } from '../../../../tests/helpers/runtime';

describe('runtime reconcile operation', () => {
  test('repairs stale sessions and releases workspaces', () => {
    const home = initHome();
    const project = createProjectFixture(home);
    const feature = approveFeature(createFeature({ home, projectId: project.id, title: 'Reconcile target', gherkinText: 'Feature: Reconcile target' }).id, home)!;
    const started: any = startLoop(feature.id, home);
    const db = new Database(resolveRuntime(home).paths.dbPath);
    db.query("update sessions set status='stale' where id = ?").run(started.session.id);
    db.query("update runs set status='executing' where id = ?").run(started.run.id);
    db.query("update tasks set status='running' where id = ?").run(started.task.id);
    db.query("update workspaces set status='locked', session_id=? where id = ?").run(started.session.id, started.feature.currentWorkspaceId);
    const reconciled = reconcile(home);
    expect(reconciled.repairedSessions).toContain(started.session.id);
    expect(reconciled.releasedWorkspaces.length).toBeGreaterThan(0);
    expect(reconciled.revivedTasks.length).toBeGreaterThan(0);
    db.close();
  });
});
