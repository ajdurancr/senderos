/** Test infrastructure only: never inherit an operator's database credentials. */
export function testEnvironment(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env.SENDEROS_DATABASE_URL;
  delete env.SENDEROS_DATABASE_AUTH_TOKEN;
  return { ...env, NO_COLOR: '1', ...overrides };
}

export function requireTerminalSupport() {
  if (!['linux', 'darwin'].includes(process.platform) ||
      !Bun.semver.satisfies(Bun.version, '>=1.3.14') || typeof Bun.Terminal !== 'function') {
    throw new Error(`Terminal safety tests require Bun >=1.3.14 on Linux or macOS (repository toolchain: Bun 1.3.14); received Bun ${Bun.version} on ${process.platform}. Install the supported toolchain; these tests cannot be skipped.`);
  }
}

export async function runTerminal(command: string[], options: {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  prompt?: string;
  input?: string;
  beforeInput?: () => void | Promise<void>;
  timeoutMs?: number;
  onData?: (text: string) => void;
} = {}) {
  requireTerminalSupport();
  let output = '';
  let prompted = false;
  let closed = false;
  const decoder = new TextDecoder();
  let drained!: () => void;
  const terminalEnded = new Promise<void>(resolve => { drained = resolve; });
  let fail!: (error: Error) => void;
  const failed = new Promise<never>((_, reject) => { fail = reject; });
  const child = Bun.spawn(command, {
    cwd: options.cwd, env: options.env ?? testEnvironment(),
    terminal: {
      cols: 200, rows: 40,
      data(terminal, bytes) {
        const text = decoder.decode(bytes, { stream: true });
        output += text;
        try { options.onData?.(text); }
        catch (error) { fail(new Error(`Terminal output callback failed: ${error}`)); return; }
        if (!prompted && options.prompt && output.includes(options.prompt)) {
          prompted = true;
          // Observe callback failures and never write after timeout/cleanup.
          void Promise.resolve().then(options.beforeInput).then(() => {
            if (!closed && options.input !== undefined) terminal.write(options.input);
          }).catch(error => fail(new Error(`Terminal input callback failed: ${error}`)));
        }
      },
      // Linux may report EIO at PTY EOF. This is a drain notification, not
      // the child's exit status; await child.exited separately below.
      exit() { output += decoder.decode(); drained(); },
    },
  });
  const deadline = setTimeout(() => fail(new Error(
    `Terminal fixture timed out after ${options.timeoutMs ?? 10_000} ms (${prompted ? 'after prompt' : 'before prompt/exit'}).`,
  )), options.timeoutMs ?? 10_000);
  try {
    if (!child.terminal) throw new Error(`Bun ${Bun.version} did not allocate child.terminal. Terminal safety tests require working PTY support; use the repository toolchain.`);
    const [exitCode] = await Promise.race([Promise.all([child.exited, terminalEnded]), failed]);
    if (options.prompt && !prompted) throw new Error(`Child exited before the expected terminal prompt ${JSON.stringify(options.prompt)}.`);
    return { exitCode, output, prompted, signalCode: child.signalCode };
  } catch (error) {
    throw new Error(`${(error as Error).message}\nCaptured terminal output:\n${output}`);
  } finally {
    closed = true;
    clearTimeout(deadline);
    if (child.exitCode === null) child.kill('SIGKILL');
    await child.exited;
    child.terminal?.close();
  }
}

/** Check the actual child descriptors and both output channels before reset. */
export async function verifyTerminalSupport() {
  const result = await runTerminal([process.execPath, '-e', `
    if (![process.stdin, process.stdout, process.stderr].every(stream => stream.isTTY))
      throw new Error('PTY child stdin, stdout and stderr must all be terminals');
    process.stdout.write('PTY stdout ready\\n');
    process.stderr.write('PTY stderr ready\\n');
  `]);
  if (result.exitCode !== 0 || !result.output.includes('PTY stdout ready') || !result.output.includes('PTY stderr ready')) {
    throw new Error(`PTY allocation/capture probe failed with Bun ${Bun.version}:\n${result.output}`);
  }
}
