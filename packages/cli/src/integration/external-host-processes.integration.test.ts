import { expect, test } from 'bun:test';
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// This suite intentionally does not import Core, runCli, or a database driver.
// Every state mutation goes through an independently spawned public CLI process.
test('the public CLI coordinates separate host sessions, graphs, contention, recovery, and completion', async () => {
  const root = resolve(import.meta.dir, '../../../..');
  const parent = process.env.SENDEROS_TEST_RUNTIME_ROOT ?? tmpdir();
  mkdirSync(parent, { recursive: true });
  const runtime = mkdtempSync(join(parent, 'senderos-process-acceptance-'));
  const output = join(runtime, 'report.json');
  try {
    const process = Bun.spawn({
      cmd: [Bun.which('bun') ?? globalThis.process.execPath, join(root, 'scripts/external-host-simulation.ts'), '--runtime-root', runtime, '--output', output],
      cwd: root,
      stdout: 'pipe',
      stderr: 'pipe',
      env: { ...globalThis.process.env },
    });
    const [exitCode, stdout, stderr] = await Promise.all([process.exited, new Response(process.stdout).text(), new Response(process.stderr).text()]);
    expect(exitCode, `${stdout}\n${stderr}`).toBe(0);
    const report = JSON.parse(readFileSync(output, 'utf8'));
    expect(report.success).toBe(true);
    expect(report.assertionCount).toBeGreaterThan(100);
    expect(report.cliProcesses).toBeGreaterThan(100);
    expect(report.workerProcesses).toBeGreaterThan(30);
    expect(report.boundaries).toEqual({ realCliProcesses: true, independentWorkerProcesses: true, physicalMachines: 1, sharedCoordinationDatabase: 'local libSQL', sharedWorkerFilesRequired: false, modelCalls: 0, apiKeysRequired: false });
    expect(report.scenarios.map((scenario: { name: string }) => scenario.name)).toEqual([
      'isolated-host-bootstrap',
      'capability-and-workspace-preflight',
      'process-contention-replay-and-start-contract',
      'conditional-backedge-and-bounded-cycles',
      'multi-context-fanout-and-explicit-join',
      'conditional-rejection-and-unselected-join-paths',
      'join-retry-and-completion-replay',
      'nested-forks-convergence-and-join-generations',
      'completion-evidence-and-publication-pinning',
      'crash-orphan-unknown-finished-and-fencing-recovery',
      'grant-revocation-drains-owned-worker',
      'worker-cancellation-acknowledgement',
    ]);
  } finally {
    rmSync(runtime, { recursive: true, force: true });
  }
}, 180_000);
