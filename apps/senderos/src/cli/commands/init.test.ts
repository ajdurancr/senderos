import { describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { handleInit } from './init';
import { tempHome } from '../../../tests/helpers/runtime';

describe('init command', () => {
  test('returns a non-mutating preview without approval', async () => {
    const home = tempHome();
    expect((await handleInit({ home, harness: 'codex' })).requiresApproval).toBe(true);
    expect(existsSync(join(home, 'config.json'))).toBe(false);
  });

  test('creates a configured runtime after approval', async () => {
    const home = tempHome();
    expect((await handleInit({ home, harness: 'codex', approve: true })).home).toBe(home);
    expect(existsSync(join(home, 'config.json'))).toBe(true);
  });

  test('requires an explicit harness when none can be inferred', async () => {
    const keys = ['OPENCLAW_WORKSPACE_DIR', 'OPENCLAW_STATE_DIR', 'OPENCLAW_SESSION_KEY', 'CODEX_SANDBOX', 'CODEX_HOME', 'CODEX_SESSION_ID', 'CLAUDECODE', 'CLAUDE_CODE_ENTRYPOINT', 'CLAUDECODE_SESSION'];
    const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
    for (const key of keys) delete process.env[key];
    try {
      await expect(handleInit({ home: tempHome(), approve: true })).rejects.toThrow('Harness is not known');
    } finally {
      for (const key of keys) previous[key] === undefined ? delete process.env[key] : (process.env[key] = previous[key]);
    }
  });
});
