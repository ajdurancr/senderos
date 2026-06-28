import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { loadConfig } from '../config/runtime';
import { tempHome } from '../../tests/helpers/runtime';
import { runCli } from './run';

describe('runCli', () => {
  test('handles init preview, approval, and routes real commands', async () => {
    const home = tempHome();
    const logs: string[] = [];
    const original = console.log;

    console.log = (...args: unknown[]) => logs.push(args.join(' '));

    try {
      await runCli(['init', '--home', home, '--harness', 'codex']);
    } finally {
      console.log = original;
    }

    expect(logs.join('\n')).toContain('requiresApproval');
    expect(existsSync(join(home, 'config.json'))).toBe(false);

    await runCli(['init', '--home', home, '--harness', 'codex', '--approve']);
    await runCli(['config', 'set', 'defaultHarness', 'codex', '--home', home]);

    expect(loadConfig(home).defaultHarness).toBe('codex');
    expect(readFileSync(join(home, 'config.json'), 'utf8')).toContain('codex');
  });
});
