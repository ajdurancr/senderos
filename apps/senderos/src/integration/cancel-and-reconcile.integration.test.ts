import { afterAll, afterEach, describe, expect, test } from 'bun:test';

import { cleanupIntegrationRunRoot, cleanupIntegrationTemps, cli, createTempProject, openDb, tempDir } from './helpers';

afterEach(cleanupIntegrationTemps);
afterAll(cleanupIntegrationRunRoot);

describe('integration: cancellation and reconciliation flows', () => {
  test('canceling a run cancels the feature and closes active sessions', () => {
    const home = tempDir('senderos-int-home');
    const projectRoot = createTempProject({ dirPrefix: 'senderos-cancel-project', packageName: 'senderos-cancel' });

    cli(['init', '--home', home, '--harness', 'codex', '--approve']);
    const project: any = cli([
      'project',
      'create',
      '--home',
      home,
      '--canonical-path',
      projectRoot,
      '--github-owner',
      'ajdurancr',
      '--github-repo',
      'senderos',
    ]);
    const feature: any = cli([
      'feature',
      'create',
      '--home',
      home,
      '--project-id',
      project.id,
      '--title',
      'Cancel flow',
      '--gherkin',
      'Feature: Cancel flow\n  Scenario: Cancel a running feature\n    Given a running SenderOS feature\n    When the run is canceled\n    Then SenderOS should cancel the feature',
    ]);

    cli(['feature', 'approve', feature.id, '--home', home]);
    const started: any = cli(['run', 'start', '--feature-id', feature.id, '--home', home]);
    const canceledRun: any = cli(['run', 'cancel', started.run.id, '--home', home]);
    expect(canceledRun.status).toBe('canceled');

    const canceledFeature: any = cli(['feature', 'show', feature.id, '--home', home]);
    expect(canceledFeature.status).toBe('canceled');
    expect(canceledFeature.currentRunId).toBeNull();

    const status: any = cli(['status', '--home', home]);
    expect(status.activeRuns).toBe(0);
    expect(status.activeSessionIds).toEqual([]);

    const db = openDb(home);
    const sessionRows = db.query('select status from sessions order by created_at asc').all() as Array<{ status: string }>;
    expect(sessionRows.every((row) => row.status === 'completed')).toBe(true);
    db.close();
  });

  test('reconcile repairs stale sessions and releases orphaned workspaces', () => {
    const home = tempDir('senderos-int-home');
    const projectRoot = createTempProject({ dirPrefix: 'senderos-reconcile-project', packageName: 'senderos-reconcile' });

    cli(['init', '--home', home, '--harness', 'codex', '--approve']);
    const project: any = cli([
      'project',
      'create',
      '--home',
      home,
      '--canonical-path',
      projectRoot,
      '--github-owner',
      'ajdurancr',
      '--github-repo',
      'senderos',
    ]);
    const feature: any = cli([
      'feature',
      'create',
      '--home',
      home,
      '--project-id',
      project.id,
      '--title',
      'Reconcile flow',
      '--gherkin',
      'Feature: Reconcile flow\n  Scenario: Repair stale session\n    Given a stale session\n    When reconcile runs\n    Then SenderOS should repair runtime state',
    ]);

    cli(['feature', 'approve', feature.id, '--home', home]);
    const started: any = cli(['run', 'start', '--feature-id', feature.id, '--home', home]);

    const db = openDb(home);
    db.query("update sessions set status='stale' where id = ?").run(started.session.id);
    db.query("update workspaces set status='locked', session_id=? where id = ?").run(
      started.session.id,
      started.feature.currentWorkspaceId
    );
    db.close();

    const reconciled: any = cli(['reconcile', '--home', home]);
    expect(reconciled.repairedSessions).toContain(started.session.id);
    expect(reconciled.releasedWorkspaces).toContain(started.feature.currentWorkspaceId);
    expect(reconciled.revivedTasks).toContain(started.task.id);
  });
});
