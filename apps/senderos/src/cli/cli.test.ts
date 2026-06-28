import { describe, expect, test } from 'bun:test';

import { parseArgs } from '../cli/args';
import { handleConfig } from '../cli/commands/config';
import { handleFeature } from '../cli/commands/feature';
import { handleInit } from '../cli/commands/init';
import { handleLoop } from '../cli/commands/loop';
import { handleRun } from '../cli/commands/run';
import { handleSession } from '../cli/commands/session';
import { handleSystemCommand } from '../cli/commands/system';
import { collectHelpLeaves, resolveHelp, rootHelp } from '../cli/help';
import { runCli } from '../cli/run';
import { requirePositional, resolveHome } from '../cli/shared';
import { loadConfig } from '../config/runtime';
import { initHome, tempHome } from '../../tests/helpers/runtime';
import * as publicApi from '../index';

describe('cli helpers and routing', () => {
  test('parses argv, resolves homes, and enforces positional args', () => {
    expect(parseArgs(['feature', 'create', '--title', 'Ship it', '--approve'])).toEqual({
      positionals: ['feature', 'create'],
      options: { title: 'Ship it', approve: true },
    });
    expect(resolveHome(undefined)).toContain('.senderos');
    expect(resolveHome('/tmp/custom-home')).toBe('/tmp/custom-home');
    expect(requirePositional('feature-1', 'feature id')).toBe('feature-1');
    expect(() => requirePositional(undefined, 'feature id')).toThrow(
      'Missing required argument: feature id'
    );
  });

  test('serves help metadata and re-exports the public API barrel', () => {
    expect(resolveHelp()).toBe(rootHelp);
    expect(resolveHelp('feature').command).toBe('feature');
    expect(resolveHelp('feature', 'create').command).toBe('create');
    expect(resolveHelp('missing').command).toBe('senderos');
    expect(collectHelpLeaves(rootHelp).length).toBeGreaterThan(rootHelp.subcommands!.length);
    expect(typeof publicApi.runCli).toBe('function');
  });

  test('handles init preview, approval, and unknown inferred harness errors', async () => {
    const previewHome = tempHome();
    expect(await handleInit({ home: previewHome, harness: 'codex' })).toMatchObject({
      home: previewHome,
      inferredHarness: 'codex',
      requiresApproval: true,
    });

    const approvedHome = tempHome();
    const approved = await handleInit({ home: approvedHome, harness: 'codex', approve: true });
    expect(approved).toEqual({
      home: approvedHome,
      configPath: `${approvedHome}/config.json`,
    });

    const originalMarkers = {
      CODEX_HOME: process.env.CODEX_HOME,
      CODEX_SANDBOX: process.env.CODEX_SANDBOX,
      CODEX_SESSION_ID: process.env.CODEX_SESSION_ID,
      OPENCLAW_WORKSPACE_DIR: process.env.OPENCLAW_WORKSPACE_DIR,
      OPENCLAW_STATE_DIR: process.env.OPENCLAW_STATE_DIR,
      OPENCLAW_SESSION_KEY: process.env.OPENCLAW_SESSION_KEY,
      CLAUDECODE: process.env.CLAUDECODE,
      CLAUDE_CODE_ENTRYPOINT: process.env.CLAUDE_CODE_ENTRYPOINT,
      CLAUDECODE_SESSION: process.env.CLAUDECODE_SESSION,
    };

    for (const key of Object.keys(originalMarkers)) {
      delete process.env[key];
    }

    try {
      await expect(handleInit({ home: tempHome(), approve: true })).rejects.toThrow(
        'Harness is not known. Re-run with --harness <openclaw|codex|claude-code> and --approve.'
      );
    } finally {
      Object.assign(process.env, originalMarkers);
    }
  });

  test('routes command handlers through real runtime state', async () => {
    const home = initHome();

    expect(handleConfig('show', ['config', 'show'], home)).toMatchObject({
      database: { kind: 'local' },
    });
    expect(handleConfig('set', ['config', 'set', 'defaultHarness', 'codex'], home)).toMatchObject({
      defaultHarness: 'codex',
    });
    expect(handleConfig('get', ['config', 'get', 'defaultHarness'], home)).toEqual({
      path: 'defaultHarness',
      value: 'codex',
    });
    expect(() => handleConfig('nope', ['config', 'nope'], home)).toThrow('Unknown config action');

    const created = handleFeature(
      'create',
      ['feature', 'create'],
      {
        title: 'CLI feature',
        'problem-statement': 'Problem',
        contract: 'Contract',
        'completion-criteria': 'Done',
      },
      home
    ) as any;
    expect(created.title).toBe('CLI feature');
    expect((handleFeature('list', ['feature', 'list'], {}, home) as any[]).length).toBe(1);
    expect(handleFeature('show', ['feature', 'show', created.id], {}, home)).toMatchObject({
      id: created.id,
    });
    expect(
      handleFeature('update', ['feature', 'update', created.id], { title: 'CLI feature updated' }, home)
    ).toMatchObject({
      title: 'CLI feature updated',
    });
    expect(handleFeature('approve', ['feature', 'approve', created.id], {}, home)).toMatchObject({
      status: 'ready_contract',
    });

    const loopStarted = handleLoop('start', ['loop', 'start', created.id], home) as any;
    expect(loopStarted.run.status).toBe('running');
    expect(handleLoop('show', ['loop', 'show', created.id], home)).toMatchObject({
      feature: { id: created.id },
    });
    expect(handleLoop('resume', ['loop', 'resume', created.id], home)).toMatchObject({
      feature: { id: created.id },
    });
    expect(handleLoop('tick', ['loop', 'tick', created.id], home)).toMatchObject({
      feature: { id: created.id },
    });
    expect(() => handleLoop('skip', ['loop', 'skip', created.id], home)).toThrow('Unknown loop action');

    expect(handleRun('list', ['run', 'list'], home)).toEqual(expect.any(Array));
    expect(handleRun('show', ['run', 'show', loopStarted.run.id], home)).toMatchObject({
      id: loopStarted.run.id,
    });
    expect(handleRun('cancel', ['run', 'cancel', loopStarted.run.id], home)).toMatchObject({
      status: 'canceled',
    });
    expect(() => handleRun('skip', ['run', 'skip'], home)).toThrow('Unknown run action');

    expect(handleSession('list', ['session', 'list'], home)).toEqual(expect.any(Array));
    expect(handleSession('show', ['session', 'show', loopStarted.session.id], home)).toMatchObject({
      id: loopStarted.session.id,
    });
    expect(
      handleSession('resume', ['session', 'resume', loopStarted.session.id], home)
    ).toMatchObject({
      resumeCommand: `senderos session resume ${loopStarted.session.id}`,
    });
    expect(() => handleSession('skip', ['session', 'skip'], home)).toThrow('Unknown session action');

    expect(handleSystemCommand('doctor', home)).toMatchObject({ ok: true });
    expect(handleSystemCommand('status', home)).toMatchObject({ openFeatures: expect.any(Number) });
    expect(handleSystemCommand('reconcile', home)).toMatchObject({ repairedSessions: expect.any(Array) });
    expect(handleSystemCommand('schedule-plan', home)).toMatchObject({
      jobName: 'senderos-loop-maintenance',
    });
    expect(() => handleSystemCommand('unknown', home)).toThrow('Unknown command: unknown');

    expect(handleFeature('cancel', ['feature', 'cancel', created.id], {}, home)).toMatchObject({
      status: 'canceled',
    });

    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => logs.push(args.join(' '));

    try {
      await runCli(['help', 'feature']);
      await runCli(['config', 'get', 'defaultHarness', '--home', home]);
    } finally {
      console.log = originalLog;
    }

    expect(logs.join('\n')).toContain('"command": "feature"');
    expect(logs.join('\n')).toContain('"value": "codex"');
    expect(loadConfig(home).defaultHarness).toBe('codex');
  });
});
