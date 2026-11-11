// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runJsonCommand } from './runtime-command';

describe('isolated browser fixture JSON transport', () => {
  let directory: string;
  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'fixture-output-test-'));
    vi.stubEnv('TMPDIR', directory);
    vi.stubEnv('TMP', directory);
    vi.stubEnv('TEMP', directory);
  });
  afterEach(() => {
    try { expect(readdirSync(directory)).toEqual([]); }
    finally { vi.unstubAllEnvs(); rmSync(directory, { recursive: true, force: true }); }
  });
  it('retains the complete snapshot beyond the subprocess pipe limit', () => {
    const records = Array.from({ length: 6000 }, (_, index) => ({ id: `record-${index}`, detail: 'é'.repeat(100) }));
    const result = runJsonCommand(process.execPath, ['-e', "console.log(JSON.stringify(Array.from({ length: 6000 }, (_, index) => ({ id: `record-${index}`, detail: 'é'.repeat(100) }))))"], process.env);
    expect(result).toEqual(records);
  });

  it('propagates a failed child even when it has written valid JSON', () => {
    let failure: unknown;
    try {
      runJsonCommand(process.execPath, ['-e', 'console.log("{}"); console.error("retained child diagnostic"); process.exit(7)'], process.env);
    } catch (error) { failure = error; }
    expect(failure).toMatchObject({ status: 7 });
    expect(String((failure as { stderr: Buffer }).stderr)).toContain('retained child diagnostic');
  });

  it('uses a private result file and preserves the supplied child environment', () => {
    const result = runJsonCommand(process.execPath, ['-e', 'console.log(JSON.stringify({mode: require("node:fs").fstatSync(1).mode & 0o777, marker: process.env.FIXTURE_MARKER}))'], { ...process.env, FIXTURE_MARKER: 'isolated fixture' });
    expect(result).toEqual({ mode: 0o600, marker: 'isolated fixture' });
  });

  it('preserves a launch failure and removes its temporary output', () => {
    expect(() => runJsonCommand(join(directory, 'missing-executable'), [], process.env)).toThrow(expect.objectContaining({ code: 'ENOENT' }));
  });

  it('times out a child after 20 seconds even when it has already written valid JSON', () => {
    expect(() => runJsonCommand(process.execPath, ['-e', 'console.log("{}"); setInterval(() => {}, 1000)'], process.env)).toThrow(expect.objectContaining({ code: 'ETIMEDOUT', signal: 'SIGTERM' }));
  }, 25_000);

  it('rejects incomplete JSON from a successful child', () => {
    expect(() => runJsonCommand(process.execPath, ['-e', 'console.log("{")'], process.env)).toThrow();
  });
});
