import { afterEach, describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tempPaths: string[] = [];

function tempDir(prefix: string) {
  const path = mkdtempSync(join(tmpdir(), `${prefix}-`));
  tempPaths.push(path);
  return path;
}

function createTempProject() {
  const root = tempDir('senderos-int-project');
  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify(
      {
        name: 'senderos-smoke',
        private: true,
        scripts: {
          build: 'echo build',
          test: 'echo test',
          lint: 'echo lint',
        },
      },
      null,
      2
    )
  );
  mkdirSync(join(root, 'src'), { recursive: true });
  writeFileSync(join(root, 'src', 'index.ts'), 'export const smoke = true;\n');
  return root;
}

function cli(args: string[], cwd = process.cwd()) {
  const result = Bun.spawnSync({
    cmd: ['bun', 'src/index.ts', ...args],
    cwd,
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...process.env },
  });

  const stdout = result.stdout.toString().trim();
  const stderr = result.stderr.toString().trim();

  if (result.exitCode !== 0) {
    throw new Error(`Command failed: bun src/index.ts ${args.join(' ')}\nstdout: ${stdout}\nstderr: ${stderr}`);
  }

  return stdout ? JSON.parse(stdout) : null;
}

afterEach(() => {
  while (tempPaths.length) {
    rmSync(tempPaths.pop()!, { recursive: true, force: true });
  }
});

describe('senderos cli integration', () => {
  test('covers init, project, feature, loop, run, session, status, doctor, and cleanup', () => {
    const home = tempDir('senderos-int-home');
    const projectRoot = createTempProject();

    const initResult: any = cli(['init', '--home', home, '--harness', 'codex', '--approve']);
    expect(initResult.home).toBe(home);

    const doctor: any = cli(['doctor', '--home', home]);
    expect(doctor.ok).toBe(true);

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

    expect(project.id).toContain('senderos-smoke-');
    expect((cli(['project', 'list', '--home', home]) as any[])[0].id).toBe(project.id);
    expect((cli(['project', 'show', project.id, '--home', home]) as any).canonicalPath).toBe(projectRoot);

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
      'Feature: Local smoke test\n  Scenario: Initialize SenderOS local flow\n    Given a configured local SenderOS project\n    When the feature is approved for implementation\n    Then SenderOS should create loop state for execution',
    ]);

    expect(feature.status).toBe('awaiting_scenario_approval');
    expect((cli(['feature', 'list', '--home', home]) as any[])[0].id).toBe(feature.id);

    const approved: any = cli(['feature', 'approve', feature.id, '--home', home]);
    expect(approved.status).toBe('active');

    const started: any = cli(['loop', 'start', feature.id, '--home', home]);
    expect(started.run.status).toBe('executing');

    const loopShow: any = cli(['loop', 'show', feature.id, '--home', home]);
    expect(loopShow.feature.loopPhase).toBe('implementation');
    expect(loopShow.workspace.root_path).toContain(`${project.id}/${feature.id}`);
    expect(existsSync(loopShow.workspace.root_path)).toBe(true);
    expect(existsSync(join(loopShow.workspace.root_path, 'package.json'))).toBe(true);

    expect((cli(['run', 'list', '--home', home]) as any[]).length).toBe(1);
    const sessions: any[] = cli(['session', 'list', '--home', home]) as any[];
    expect(sessions.length).toBe(1);
    expect((cli(['session', 'resume', sessions[0].id, '--home', home]) as any).launchCommand).toContain('codex exec');

    cli(['loop', 'tick', feature.id, '--home', home]);
    cli(['loop', 'tick', feature.id, '--home', home]);
    cli(['loop', 'tick', feature.id, '--home', home]);

    const completedFeature: any = cli(['feature', 'show', feature.id, '--home', home]);
    expect(completedFeature.status).toBe('completed');
    expect(completedFeature.loopPhase).toBe('done');

    const status: any = cli(['status', '--home', home]);
    expect(status.projects.total).toBe(1);
    expect(status.activeRuns).toBe(0);
    expect(status.activeSessionIds).toEqual([]);
    expect(status.workspaceLocks).toBe(0);

    expect(existsSync(loopShow.workspace.root_path)).toBe(false);

    const db = new Database(join(home, 'senderos.db'));
    const sessionRows = db.query('select status from sessions order by created_at asc').all() as Array<{ status: string }>;
    expect(sessionRows.every((row) => row.status === 'completed')).toBe(true);
    const events = db.query('select event_type from events order by created_at asc').all() as Array<{ event_type: string }>;
    expect(events.map((row) => row.event_type)).toContain('feature.completed');
    expect(events.map((row) => row.event_type)).toContain('workspace.cleaned');
    db.close();
  });
});
