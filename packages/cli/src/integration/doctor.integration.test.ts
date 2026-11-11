import { afterEach, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanupIntegrationTemps, tempDir } from './helpers';
import { testEnvironment } from '../../../../scripts/test-environment';

afterEach(cleanupIntegrationTemps);
for (const config of [undefined, '{"private-marker":', 'null', '{}']) test(`doctor diagnoses an unusable home through the actual CLI: ${config}`, () => {
  const home = tempDir('doctor');
  const path = join(home, 'config.json');
  if (config !== undefined) writeFileSync(path, config);
  const result = Bun.spawnSync([process.execPath, 'src/index.ts', 'doctor', '--home', home], {
    cwd: join(import.meta.dir, '../..'), env: testEnvironment(), stdout: 'pipe', stderr: 'pipe',
  });
  expect(result.exitCode).toBe(0);
  expect(result.stderr.toString()).toBe('');
  const report = JSON.parse(result.stdout.toString());
  expect(report).toMatchObject({ ok: false, warnings: [] });
  expect(report.issues.join(' ')).toContain(config === undefined ? 'missing config' : 'invalid config');
  expect(result.stdout.toString()).not.toContain('private-marker');
  expect(existsSync(path)).toBe(config !== undefined);
  if (config !== undefined) expect(readFileSync(path, 'utf8')).toBe(config);
});
test('operational commands still require an execution context', () => {
  const home = tempDir('doctor-status');
  const result = Bun.spawnSync([process.execPath, 'src/index.ts', 'status', '--home', home], {
    cwd: join(import.meta.dir, '../..'), env: testEnvironment(), stdout: 'pipe', stderr: 'pipe',
  });
  expect(result.exitCode).toBe(1);
  expect(JSON.parse(result.stderr.toString()).error).toContain('Missing execution context');
});

test('actual CLI reports a missing registered context without changing config or retained projects', () => {
  const home = tempDir('doctor-registration');
  const databasePath = join(home, 'fixture.db');
  const env = testEnvironment({ SENDEROS_DATABASE_URL: `file:${databasePath}` });
  const invoke = (args: string[]) => {
    const result = Bun.spawnSync([process.execPath, 'src/index.ts', ...args, '--home', home], {
      cwd: join(import.meta.dir, '../..'), env, stdout: 'pipe', stderr: 'pipe',
    });
    expect(result.exitCode).toBe(0);
    expect(result.stderr.toString()).toBe('');
    return JSON.parse(result.stdout.toString());
  };
  invoke(['init', '--name', 'Diagnostic fixture', '--execution-context-id', 'diagnostic-context', '--harness', 'fixture', '--approve']);
  invoke(['project', 'create', '--name', 'Retained diagnostic project']);
  const config = readFileSync(join(home, 'config.json'));
  const db = new Database(databasePath);
  try {
    const projects = db.query('SELECT * FROM projects').all();
    expect(projects).toHaveLength(1);
    expect(db.query('DELETE FROM execution_contexts WHERE id = ?').run('diagnostic-context').changes).toBe(1);
    const database = readFileSync(databasePath);
    expect(invoke(['doctor'])).toMatchObject({
      ok: false, issues: ['missing execution context: configured ID is not registered in this database'],
    });
    expect(readFileSync(join(home, 'config.json'))).toEqual(config);
    expect(readFileSync(databasePath)).toEqual(database);
    expect(db.query('SELECT * FROM projects').all()).toEqual(projects);
    expect(db.query('SELECT id FROM execution_contexts').all()).toEqual([]);
  } finally { db.close(); }
});
