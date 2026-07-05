import { afterAll, afterEach, describe, expect, test } from 'bun:test';

import { cleanupIntegrationRunRoot, cleanupIntegrationTemps, cli, createTempProject, openDb, tempDir } from './helpers';

afterEach(cleanupIntegrationTemps);
afterAll(cleanupIntegrationRunRoot);

describe('integration: cancellation and status reporting flows', () => {
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
      'Feature: Cancel flow\n  Scenario: Cancel a running feature\n    Given a running Senderos feature\n    When the run is canceled\n    Then Senderos should cancel the feature',
    ]);

    cli(['feature', 'approve', feature.id, '--home', home]);
    const planItems: any[] = cli(['plan', '--home', home]);
    const item = planItems.find((entry) => entry.featureId === feature.id)!;
    const started: any = cli(['run', 'dispatch', '--feature-id', item.featureId, '--sendero-id', item.senderoId, '--agent-id', item.agentId, '--home', home]);
    const canceledRun: any = cli(['run', 'cancel', started.runId, '--home', home]);
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

  test('status reports stale sessions and orphaned workspaces without mutating them', () => {
    const home = tempDir('senderos-int-home');
    const projectRoot = createTempProject({ dirPrefix: 'senderos-status-project', packageName: 'senderos-status' });

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
      'Status flow',
      '--gherkin',
      'Feature: Status flow\n  Scenario: Report stale state\n    Given stale runtime state\n    When status runs\n    Then Senderos should report it without mutating it',
    ]);

    cli(['feature', 'approve', feature.id, '--home', home]);
    const item: any = (cli(['plan', '--home', home]) as any[]).find((entry) => entry.featureId === feature.id)!;
    const started: any = cli(['run', 'dispatch', '--feature-id', item.featureId, '--sendero-id', item.senderoId, '--agent-id', item.agentId, '--home', home]);

    const db = openDb(home);
    db.query("update sessions set status='stale' where id = ?").run(started.sessionId);
    db.query("update workspaces set status='locked', session_id=? where run_id = ?").run(started.sessionId, started.runId);
    db.close();

    const snapshot: any = cli(['status', '--home', home]);
    expect(snapshot.staleSessionIds).toContain(started.sessionId);
    expect(snapshot.orphanedWorkspaceIds.length).toBeGreaterThan(0);
  });
});
