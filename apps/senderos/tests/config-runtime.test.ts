import { describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';

import {
  configPathForHome,
  defaultConfigForHome,
  defaultHomePath,
  ensureDir,
  ensureWithinHome,
  initializeRuntime,
  loadConfig,
  previewInit,
  resolveRuntime,
  runtimeExists,
} from '../src/config/runtime';
import { initHome, tempHome } from './helpers/runtime';

describe('runtime configuration', () => {
  test('builds default home and config paths', () => {
    const home = defaultHomePath();
    expect(isAbsolute(home)).toBe(true);
    expect(configPathForHome('/tmp/senderos-home')).toBe('/tmp/senderos-home/config.json');
  });

  test('creates and resolves a local runtime', () => {
    const home = tempHome();
    const preview = previewInit(home, 'codex');
    const config = defaultConfigForHome(home, 'codex');

    expect(preview.home).toBe(home);
    expect(preview.config.database.kind).toBe('local');
    expect(preview.inferredHarness).toBe('codex');
    expect(preview.requiresApproval).toBe(true);
    expect(config.workspaceRoot).toBe(join(home, 'workspaces'));

    expect(runtimeExists(home)).toBe(false);
    ensureDir(join(home, 'scratch'));
    expect(existsSync(join(home, 'scratch'))).toBe(true);

    const initialized = initializeRuntime(home, config);
    expect(initialized.configPath).toBe(configPathForHome(home));
    expect(runtimeExists(home)).toBe(true);
    expect(loadConfig(home).defaultHarness).toBe('codex');

    const runtime = resolveRuntime(home);
    expect(runtime.paths.dbPath).toBe(join(home, 'senderos.db'));
    expect(existsSync(runtime.paths.dbPath)).toBe(true);
  });

  test('enforces home guardrails', () => {
    const home = tempHome();
    ensureDir(home);

    expect(() => ensureWithinHome(home, join(home, 'nested/path'))).not.toThrow();
    expect(() => ensureWithinHome(home, '/tmp/outside')).toThrow(
      'Guardrail violation: path outside Senderos home: /tmp/outside'
    );

    expect(() =>
      initializeRuntime(home, {
        ...defaultConfigForHome(home, 'codex'),
        workspaceRoot: '/tmp/not-allowed',
      })
    ).toThrow('Guardrail violation: path outside Senderos home: /tmp/not-allowed');
  });

  test('initializes default runtime without an explicit config', () => {
    const home = initHome();
    expect(loadConfig(home).database.kind).toBe('local');
  });
});
