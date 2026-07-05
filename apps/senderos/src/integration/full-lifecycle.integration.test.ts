import { afterAll, afterEach, describe, expect, test } from 'bun:test';

import {
  cleanupIntegrationRunRoot,
  cleanupIntegrationTemps,
  cli,
  createTempProject,
  openDb,
  tempDir,
} from './helpers';

afterEach(cleanupIntegrationTemps);
afterAll(cleanupIntegrationRunRoot);

describe('integration: full lifecycle flow', () => {
  test('plans and dispatches runs through senderos relationships', () => {
    const home = tempDir('senderos-int-home');
    const projectRoot = createTempProject();

    cli(['init', '--home', home, '--harness', 'codex', '--approve']);

    const project: any = cli([
      'project', 'create', '--home', home,
      '--canonical-path', projectRoot,
      '--github-owner', 'ajdurancr', '--github-repo', 'senderos'
    ]);

    const feature: any = cli([
      'feature', 'create', '--home', home,
      '--project-id', project.id,
      '--title', 'Local smoke test feature',
      '--gherkin', 'Feature: Local smoke test'
    ]);

    cli(['feature', 'approve', feature.id, '--home', home]);

    const firstPlan: any[] = cli(['plan', '--home', home]);
    const first = firstPlan.find((item) => item.featureId === feature.id)!;
    expect(first.senderoId).toBeTruthy();
    expect(first.agentId).toBeTruthy();
    expect(first.previousRunId).toBeNull();

    const started: any = cli([
      'run', 'dispatch',
      '--feature-id', first.featureId,
      '--sendero-id', first.senderoId,
      '--agent-id', first.agentId,
      '--home', home,
    ]);
    expect(started.runId).toBeTruthy();
    expect(started.sessionId).toBeTruthy();

    const state: any = cli(['run', 'state', '--feature-id', feature.id, '--home', home]);
    expect(state.currentRun.id).toBe(started.runId);
    expect(state.currentRunExecution.runId).toBe(started.runId);
    expect(state.currentRunExecution.hostEnvironmentSessionId).toBe(started.sessionId);

    const db = openDb(home);
    db.query("update runs set status='succeeded' where id=?").run(started.runId);
    db.query("update run_executions set status='succeeded', finished_at=datetime('now') where run_id=?").run(started.runId);
    db.query("update sessions set status='completed' where run_id=?").run(started.runId);
    db.close();

    const nextPlan: any[] = cli(['plan', '--home', home]);
    const next = nextPlan.find((item) => item.featureId === feature.id)!;
    expect(next.previousRunId).toBe(started.runId);

    const nextDispatch: any = cli([
      'run', 'dispatch',
      '--feature-id', next.featureId,
      '--sendero-id', next.senderoId,
      '--agent-id', next.agentId,
      '--previous-run-id', next.previousRunId,
      '--home', home,
    ]);
    expect(nextDispatch.previousRunId).toBe(started.runId);
    expect(nextDispatch.runId).toBeTruthy();
  });
});
