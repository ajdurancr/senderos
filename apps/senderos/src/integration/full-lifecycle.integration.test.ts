import { afterAll, afterEach, describe, expect, test } from 'bun:test';
import { join } from 'node:path';

import {
  cleanupIntegrationRunRoot,
  cleanupIntegrationTemps,
  cli,
  createTempProject,
  openDb,
  pathExists,
  tempDir,
} from './helpers';

afterEach(cleanupIntegrationTemps);
afterAll(cleanupIntegrationRunRoot);

describe('integration: full lifecycle flow', () => {
  test('runs project -> feature -> implementation/review/mutation -> completion with cleanup', () => {
    const home = tempDir('senderos-int-home');
    const projectRoot = createTempProject();

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
      '--build-command',
      'bun run build',
      '--test-command',
      'bun run test',
      '--lint-command',
      'bun run lint',
    ]);

    const feature: any = cli([
      'feature',
      'create',
      '--home',
      home,
      '--project-id',
      project.id,
      '--title',
      'Local smoke test feature',
      '--spec-text',
      'Validate local Codex-driven SenderOS flow.',
      '--source-request',
      'Run a local SenderOS smoke test with Codex.',
      '--gherkin',
      'Feature: Local smoke test\n  Scenario: Initialize SenderOS local flow\n    Given a configured local SenderOS project\n    When the feature is approved for implementation\n    Then SenderOS should create run state for execution',
    ]);

    expect(feature.status).toBe('awaiting_scenario_approval');
    expect((cli(['feature', 'list', '--home', home]) as any[])[0].id).toBe(feature.id);

    const approved: any = cli(['feature', 'approve', feature.id, '--home', home]);
    expect(approved.status).toBe('active');

    const started: any = cli(['run', 'start', '--feature-id', feature.id, '--home', home]);
    expect(started.run.status).toBe('executing');

    const implementationState: any = cli(['run', 'state', '--feature-id', feature.id, '--home', home]);
    expect(implementationState.feature.senderoStep).toBe('implementation');
    expect(implementationState.currentRunExecution.status).toBe('running');
    expect(implementationState.workspace.root_path).toContain(`${project.id}/${feature.id}`);
    expect(pathExists(implementationState.workspace.root_path)).toBe(true);
    expect(pathExists(join(implementationState.workspace.root_path, 'package.json'))).toBe(true);

    const sessionsAtStart: any[] = cli(['session', 'list', '--home', home]);
    expect(sessionsAtStart).toHaveLength(1);
    expect(implementationState.currentRunExecution.hostEnvironmentSessionId).toBe(sessionsAtStart[0].id);
    const resumedSession: any = cli(['session', 'resume', sessionsAtStart[0].id, '--home', home]);
    expect(resumedSession.launchCommand).toContain('codex exec');

    const reviewTick: any = cli(['run', 'advance', '--feature-id', feature.id, '--home', home]);
    expect(reviewTick.feature.senderoStep).toBe('review');
    const reviewState: any = cli(['run', 'state', '--feature-id', feature.id, '--home', home]);
    expect(reviewState.currentRun.phase).toBe('review');
    expect(reviewState.currentRun.base_branch).toBe(`feature/${feature.id}`);

    const mutationTick: any = cli(['run', 'advance', '--feature-id', feature.id, '--home', home]);
    expect(mutationTick.feature.senderoStep).toBe('mutation');

    const completionTick: any = cli(['run', 'advance', '--feature-id', feature.id, '--home', home]);
    expect(completionTick.feature.senderoStep).toBe('done');
    expect(completionTick.feature.status).toBe('completed');

    const completedFeature: any = cli(['feature', 'show', feature.id, '--home', home]);
    expect(completedFeature.currentRunId).toBeNull();

    const status: any = cli(['status', '--home', home]);
    expect(status.openFeatures).toBe(0);
    expect(status.activeSupervisions).toBe(0);
    expect(status.activeRuns).toBe(0);
    expect(status.activeSessionIds).toEqual([]);
    expect(status.workspaceLocks).toBe(0);

    expect(pathExists(implementationState.workspace.root_path)).toBe(false);

    const db = openDb(home);
    const sessionRows = db.query('select status from sessions order by created_at asc').all() as Array<{ status: string }>;
    expect(sessionRows.every((row) => row.status === 'completed')).toBe(true);
    const runRows = db.query('select phase, status from runs order by created_at asc').all() as Array<{ phase: string; status: string }>;
    expect(runRows).toEqual([
      { phase: 'implementation', status: 'succeeded' },
      { phase: 'review', status: 'succeeded' },
      { phase: 'mutation', status: 'succeeded' },
    ]);
    const runExecutionRows = db.query('select status from run_executions order by created_at asc').all() as Array<{ status: string }>;
    expect(runExecutionRows).toEqual([
      { status: 'succeeded' },
      { status: 'succeeded' },
      { status: 'succeeded' },
    ]);
    const events = db.query('select event_type from events order by created_at asc').all() as Array<{ event_type: string }>;
    expect(events.map((row) => row.event_type)).toContain('feature.completed');
    expect(events.map((row) => row.event_type)).toContain('workspace.cleaned');
    db.close();
  });
});
