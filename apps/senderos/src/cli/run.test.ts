import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { loadConfig } from '../config/runtime';
import { tempHome } from '../../tests/helpers/runtime';
import { runCli } from './run';

describe('runCli', () => {
  test('init without approve only prints the preview', async () => {
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
  });

  test('init with approve creates the runtime', async () => {
    const home = tempHome();
    await runCli(['init', '--home', home, '--harness', 'codex', '--approve']);
    expect(existsSync(join(home, 'config.json'))).toBe(true);
  });

  test('agent command family routes through runCli', async () => {
    const home = tempHome();
    const logs: string[] = [];
    const original = console.log;
    console.log = (...args: unknown[]) => logs.push(args.join(' '));

    try {
      await runCli(['init', '--home', home, '--harness', 'codex', '--approve']);
      await runCli(['agent', 'list', '--home', home]);
    } finally {
      console.log = original;
    }

    expect(logs.join('\n')).toContain('spec-partner');
  });

  test('help output includes agent descriptions by default and can omit them', async () => {
    const logs: string[] = [];
    const original = console.log;
    console.log = (...args: unknown[]) => logs.push(args.join(' '));

    try {
      await runCli(['run', 'dispatch', '--help']);
      await runCli(['run', 'dispatch', '--help', '--omit-agent-description']);
    } finally {
      console.log = original;
    }

    expect(logs[0]).toContain('agentDescription');
    expect(logs[1]).not.toContain('agentDescription');
  });

  test('config commands route through runCli and persist updates', async () => {
    const home = tempHome();
    await runCli(['init', '--home', home, '--harness', 'codex', '--approve']);
    await runCli(['config', 'set', 'defaultHarness', 'codex', '--home', home]);
    expect(loadConfig(home).defaultHarness).toBe('codex');
    expect(readFileSync(join(home, 'config.json'), 'utf8')).toContain('codex');
  });
});
