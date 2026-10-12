import { resolve } from 'node:path';
import { runTerminal, testEnvironment, verifyTerminalSupport } from '../packages/cli/src/integration/terminal-fixture';

const mode = process.argv[2];
if (mode !== 'terminal' && mode !== 'pipe') throw new Error('Usage: bun scripts/check-release-terminal.ts <terminal|pipe>');
await verifyTerminalSupport();
const cwd = resolve(import.meta.dir, '../packages/cli');
const env = testEnvironment();
// This process is the release runner's parent. Check its real descriptors before
// passing them through the entire prepublishOnly -> release:check chain.
const command = [process.execPath, '-e', `
  const expected = ${mode === 'terminal'};
  for (const stream of [process.stdin, process.stdout, process.stderr]) {
    if (Boolean(stream.isTTY) !== expected) throw new Error('Unexpected release parent terminal mode');
  }
  console.log('Release parent terminal mode verified: ${mode}');
  const child = Bun.spawnSync([process.execPath, 'run', 'prepublishOnly'], {
    stdin: 'inherit', stdout: 'inherit', stderr: 'inherit',
  });
  process.exit(child.exitCode);
`];
if (mode === 'terminal') {
  const result = await runTerminal(command, { cwd, env, timeoutMs: 600_000, onData: text => process.stdout.write(text) });
  process.exitCode = result.exitCode;
} else {
  const child = Bun.spawn(command, { cwd, env, stdin: 'ignore', stdout: 'pipe', stderr: 'pipe', timeout: 600_000, killSignal: 'SIGKILL' });
  await Promise.all([
    (async () => { for await (const chunk of child.stdout) process.stdout.write(chunk); })(),
    (async () => { for await (const chunk of child.stderr) process.stderr.write(chunk); })(),
  ]);
  process.exitCode = await child.exited;
}
