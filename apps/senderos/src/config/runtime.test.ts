import { describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { defaultConfigForHome, defaultHomePath, configPathForHome, ensureWithinHome, initializeRuntime, loadConfig, previewInit, resolveRuntime } from './runtime';
import { tempHome } from '../../tests/helpers/runtime';

describe('runtime configuration', () => {
  test('builds default home/config paths and preview init', () => {
    const home = tempHome();
    expect(configPathForHome(home)).toBe(`${home}/config.json`);
    expect(defaultConfigForHome(home, 'codex').defaultHarness).toBe('codex');
    expect(previewInit(home, 'codex').requiresApproval).toBe(true);
    expect(defaultHomePath()).toContain('.senderos');
  });
  test('creates and resolves a local runtime with guardrails', () => {
    const home = tempHome();
    initializeRuntime(home);
    expect(existsSync(resolveRuntime(home).paths.dbPath)).toBe(true);
    expect(loadConfig(home).database.kind).toBe('local');
    expect(() => ensureWithinHome(home, '/tmp/outside')).toThrow();
  });
});
