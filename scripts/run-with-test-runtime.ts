import { mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const command = process.argv.slice(2);
if (!command.length) {
  throw new Error('Expected a command to run inside the test runtime.');
}

const workspaceRoot = resolve(import.meta.dir, '..');
const runtimeRoot = resolve(workspaceRoot, '.tmp/test-runtime');

rmSync(runtimeRoot, { recursive: true, force: true });
mkdirSync(runtimeRoot, { recursive: true });

try {
  const result = Bun.spawnSync(command, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      SENDEROS_TEST_RUNTIME_ROOT: runtimeRoot,
      TMPDIR: runtimeRoot,
      TMP: runtimeRoot,
      TEMP: runtimeRoot,
    },
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
  });

  process.exitCode = result.exitCode;
} finally {
  rmSync(runtimeRoot, { recursive: true, force: true });
}
