import { afterEach, expect, test } from 'bun:test';
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
