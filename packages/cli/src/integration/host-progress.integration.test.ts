import { expect, test } from 'bun:test';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { testEnvironment } from '../../../../scripts/test-environment';

test('an interrupted host simulator retains token-safe scenario and pending CLI progress', async () => {
  const root = resolve(import.meta.dir, '../../../..');
  const parent = process.env.SENDEROS_TEST_RUNTIME_ROOT ?? tmpdir();
  mkdirSync(parent, { recursive: true });
  const runtime = mkdtempSync(join(parent, 'host-progress-'));
  const output = join(runtime, 'report.json');
  const progress = `${output}.progress.log`;
  writeFileSync(output, JSON.stringify({ success: true, stale: true }));
  writeFileSync(progress, `${JSON.stringify({ event: 'stale', command: 'synthetic-stale-secret' })}\n`);
  const child = spawn(process.execPath, [join(root, 'scripts/external-host-simulation.ts'),
    '--runtime-root', runtime, '--output', output], {
    cwd: root, env: testEnvironment(), detached: true, stdio: 'ignore',
  });
  const exited = new Promise<void>((resolve, reject) => {
    child.once('exit', () => resolve());
    child.once('error', reject);
  });
  let interrupted = false;
  try {
    const deadline = Date.now() + 3_000;
    while (Date.now() < deadline) {
      if (existsSync(progress) && readFileSync(progress, 'utf8').includes('cli-start')) break;
      await Bun.sleep(10);
    }
    // Kill the disposable controller and all children exactly as the CI deadline does.
    process.kill(-child.pid!, 'SIGKILL');
    interrupted = true;
    await exited;
    expect(child.signalCode).toBe('SIGKILL');
    expect(existsSync(output)).toBe(false);
    expect(existsSync(progress)).toBe(true);
    const records = readFileSync(progress, 'utf8').trim().split('\n').map(line => JSON.parse(line));
    expect(records[0]).toMatchObject({ event: 'scenario-start', scenario: 'isolated-host-bootstrap' });
    expect(records.some(record => record.event === 'cli-start' && record.command === 'init')).toBe(true);
    expect(records.every(record => Object.keys(record).every(key =>
      ['event', 'scenario', 'elapsedMs', 'command', 'id'].includes(key)))).toBe(true);
  } finally {
    // Do not signal an already-interrupted group again after the child exits.
    // A vanished group can return a platform error, or its ID may be reused.
    if (!interrupted) {
      try { process.kill(-child.pid!, 'SIGKILL'); } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
      }
    }
    await exited;
    rmSync(runtime, { recursive: true, force: true });
  }
}, 10_000);
