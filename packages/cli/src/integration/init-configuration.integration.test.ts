import { afterEach, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanupIntegrationTemps, tempDir } from './helpers';
import { testEnvironment } from '../../../../scripts/test-environment';

afterEach(cleanupIntegrationTemps);
test('rejected CLI initialization preserves the configured identity and retained project', () => {
  const home = tempDir('init-configuration');
  const invoke = (args: string[]) => Bun.spawnSync([process.execPath, 'src/index.ts', ...args, '--home', home], {
    cwd: join(import.meta.dir, '../..'),
    env: testEnvironment({ SENDEROS_DATABASE_URL: `file:${join(home, 'fixture.db')}` }),
    stdout: 'pipe', stderr: 'pipe',
  });
  expect(invoke(['init', '--name', 'Original fixture', '--execution-context-id', 'original-fixture', '--harness', 'fixture', '--approve']).exitCode).toBe(0);
  const project = invoke(['project', 'create', '--name', 'Retained fixture']);
  expect(project.exitCode).toBe(0);
  const before = readFileSync(join(home, 'config.json'));
  const rejected = invoke(['init', '--name', 'Original fixture', '--execution-context-id', 'replacement-fixture', '--harness', 'fixture', '--approve']);
  expect(rejected.exitCode).toBe(1);
  expect(JSON.parse(rejected.stderr.toString()).error).toContain('name is already in use');
  expect(readFileSync(join(home, 'config.json'))).toEqual(before);
  const projects = invoke(['project', 'list']);
  expect(projects.exitCode).toBe(0);
  expect(JSON.parse(projects.stdout.toString()).map((item: { id: string }) => item.id)).toEqual([JSON.parse(project.stdout.toString()).id]);
});
