import { expect, test } from 'bun:test';
import { runTerminal, verifyTerminalSupport } from './terminal-fixture';

test('PTY fixtures verify all child descriptors and capture stdout and stderr', verifyTerminalSupport);

test('PTY fixtures drain final output and preserve split UTF-8', async () => {
  const result = await runTerminal([process.execPath, '-e', `
    process.stdout.write(Buffer.from([0xe2]));
    await Bun.sleep(20);
    process.stdout.write(Buffer.from([0x82, 0xac]));
    process.stderr.write('x'.repeat(65536) + 'FINAL');
  `]);
  expect(result.exitCode).toBe(0);
  expect(result.output).toBe('€' + 'x'.repeat(65536) + 'FINAL');
});

test('PTY fixtures fail on an early refusal instead of passing a missing prompt', async () => {
  await expect(runTerminal([process.execPath, '-e', "console.error('wrong refusal'); process.exit(1)"], {
    prompt: 'confirmation:', input: 'yes\n',
  })).rejects.toThrow('Child exited before the expected terminal prompt');
});

test('PTY fixtures surface asynchronous input errors and reap the waiting child', async () => {
  await expect(runTerminal([process.execPath, '-e', "console.log('confirmation:'); await Bun.sleep(60000)"], {
    prompt: 'confirmation:', beforeInput: async () => { throw new Error('fixture callback failed'); },
  })).rejects.toThrow('fixture callback failed');
});

test('PTY fixtures surface output callback errors and reap the waiting child', async () => {
  await expect(runTerminal([process.execPath, '-e', "console.log('ready'); await Bun.sleep(60000)"], {
    onData: () => { throw new Error('output callback failed'); },
  })).rejects.toThrow('Terminal output callback failed');
});

test('PTY fixtures bound a missing prompt and a stalled confirmation barrier', async () => {
  for (const script of ["await Bun.sleep(60000)", "console.log('confirmation:'); await Bun.sleep(60000)"]) {
    await expect(runTerminal([process.execPath, '-e', script], {
      prompt: 'confirmation:', timeoutMs: 200,
      beforeInput: () => new Promise(() => {}),
    })).rejects.toThrow('Terminal fixture timed out');
  }
});
