import { describe, expect, test } from 'bun:test';
import { defaultHomePath, previewInit, initializeRuntime, resolveRuntime, runtimeExists } from './runtime';
import { tempHome } from '../../tests/helpers/runtime';

describe('runtime configuration', () => {
  test('defaultHomePath ends in .senderos', () => {
    expect(defaultHomePath()).toContain('.senderos');
  });

  test('previewInit marks runtime creation as approval-gated', () => {
    const preview = previewInit(undefined, 'codex');
    expect(preview.requiresApproval).toBe(true);
  });

  test('initializeRuntime creates a local runtime on disk', () => {
    const home = tempHome();
    initializeRuntime(home);
    expect(runtimeExists(home)).toBe(true);
  });

  test('resolveRuntime returns persisted configuration and paths', () => {
    const home = tempHome();
    initializeRuntime(home);
    const resolved = resolveRuntime(home);
    expect(resolved.paths.home).toBe(home);
    expect(resolved.config.database.kind).toBe('local');
  });
});
