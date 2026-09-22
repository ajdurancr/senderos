import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { loadConfig } from '@senderos/core';
import { tempHome } from '../../core/src/test-support/runtime';
import { runCli } from './run';

describe('runCli', () => {
  test('init without approve only prints the preview', async () => {
    const home = tempHome();
    const logs: string[] = [];
    const original = console.log;
    console.log = (...args: Parameters<typeof console.log>) => logs.push(args.join(' '));

    try {
      await runCli(['init', '--name', 'Preview context', '--home', home, '--harness', 'codex']);
    } finally {
      console.log = original;
    }

    expect(logs.join('\n')).toContain('requiresApproval');
    expect(existsSync(join(home, 'config.json'))).toBe(false);
  });

  test('init with approve creates the runtime', async () => {
    const home = tempHome();
    await runCli(['init', '--name', 'Approved context', '--home', home, '--harness', 'codex', '--approve']);
    expect(existsSync(join(home, 'config.json'))).toBe(true);
  });

  test('agent command family routes through runCli', async () => {
    const home = tempHome();
    const logs: string[] = [];
    const original = console.log;
    console.log = (...args: Parameters<typeof console.log>) => logs.push(args.join(' '));

    try {
      await runCli(['init', '--name', 'Agent context', '--home', home, '--harness', 'codex', '--approve']);
      await runCli(['agent', 'list', '--home', home]);
    } finally {
      console.log = original;
    }

    expect(logs.join('\n')).toContain('spec-partner');
  });

  test('sendero command family routes through runCli', async () => {
    const home = tempHome();
    const logs: string[] = [];
    const original = console.log;
    console.log = (...args: Parameters<typeof console.log>) => logs.push(args.join(' '));

    try {
      await runCli(['init', '--name', 'Sendero context', '--home', home, '--harness', 'codex', '--approve']);
      await runCli(['sendero', 'show', 'software-delivery', '--home', home]);
    } finally {
      console.log = original;
    }

    expect(logs.join('\n')).toContain('software-delivery');
    expect(logs.join('\n')).toContain('nodes');
  });

  test('help output includes agent descriptions by default and can omit them', async () => {
    const logs: string[] = [];
    const original = console.log;
    console.log = (...args: Parameters<typeof console.log>) => logs.push(args.join(' '));

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
    await runCli(['init', '--name', 'Config context', '--home', home, '--harness', 'codex', '--approve']);
    await runCli(['config', 'set', 'defaultHarness', 'codex', '--home', home]);
    expect(loadConfig(home).defaultHarness).toBe('codex');
    expect(readFileSync(join(home, 'config.json'), 'utf8')).toContain('codex');
  });

  test('bootstrap-agent-skill writes a skill scaffold and next-step guidance', async () => {
    const home = tempHome();
    const skillPath = join(home, '.agents', 'skills', 'senderos', 'SKILL.md');
    const logs: string[] = [];
    const original = console.log;
    console.log = (...args: Parameters<typeof console.log>) => logs.push(args.join(' '));

    try {
      await runCli([
        'bootstrap-agent-skill',
        '--path',
        skillPath,
      ]);
    } finally {
      console.log = original;
    }

    expect(existsSync(skillPath)).toBe(true);
    expect(readFileSync(skillPath, 'utf8')).toContain('# Senderos');
    expect(readFileSync(skillPath, 'utf8')).toContain('Use the CLI help');
    expect(readFileSync(skillPath, 'utf8')).not.toContain('--home');
    expect(readFileSync(skillPath, 'utf8')).not.toContain('--harness');
    expect(logs.join('\n')).toContain('guidance');
    expect(logs.join('\n')).toContain('CLI help');
  });

  test('bootstrap-agent-skill can print the scaffold without writing it', async () => {
    const home = tempHome();
    const skillPath = join(home, '.agents', 'skills', 'senderos', 'SKILL.md');
    const logs: string[] = [];
    const original = console.log;
    console.log = (...args: Parameters<typeof console.log>) => logs.push(args.join(' '));

    try {
      await runCli(['bootstrap-agent-skill', '--path', skillPath, '--print']);
    } finally {
      console.log = original;
    }

    expect(existsSync(skillPath)).toBe(false);
    expect(logs.join('\n')).toContain('# Senderos');
    expect(logs.join('\n')).toContain('copy-pasteable skill');
  });

  test('reports command failures as JSON and sets a failing exit code', async () => {
    const errors: string[] = [];
    const original = console.error;
    const originalExitCode = process.exitCode;
    console.error = (...args: Parameters<typeof console.error>) => errors.push(args.join(' '));
    process.exitCode = 0;
    try {
      await runCli(['wat', '--home', tempHome()]);
    } finally {
      console.error = original;
    }
    expect(errors.join('\n')).toContain('Missing execution context');
    expect(process.exitCode).toBe(1);
    process.exitCode = originalExitCode ?? 0;
  });
});
