import { describe, expect, test } from 'bun:test';
import { HARNESS_PRESETS, inferHarnessFromEnvironment } from './harness';

describe('harness utils', () => {
  test('exposes suggested harness presets without restricting custom values', () => {
    expect(HARNESS_PRESETS).toEqual([
      'openclaw',
      'codex',
      'claude-code',
      'cursor',
    ]);
  });

  test('infers harness families', () => {
    expect(
      inferHarnessFromEnvironment({
        OPENCLAW_WORKSPACE_DIR: '/tmp/workspace',
      } as NodeJS.ProcessEnv),
    ).toBe('openclaw');
    expect(
      inferHarnessFromEnvironment({
        CODEX_SESSION_ID: 'session-1',
      } as NodeJS.ProcessEnv),
    ).toBe('codex');
    expect(
      inferHarnessFromEnvironment({
        CLAUDECODE_SESSION: 'session-2',
      } as NodeJS.ProcessEnv),
    ).toBe('claude-code');
    expect(inferHarnessFromEnvironment({} as NodeJS.ProcessEnv)).toBe(
      'unknown',
    );
  });
});
