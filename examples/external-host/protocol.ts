import { resolve } from 'node:path';

/** This adapter deliberately has no Core imports and no direct database access. */
export const repositoryRoot = resolve(import.meta.dir, '../..');
export const cliEntry = resolve(repositoryRoot, 'packages/cli/src/index.ts');

export interface CliResponse<T = any> {
  exitCode: number;
  value: T;
  stderr: string;
}

export interface HostContext {
  id: string;
  hostId: string;
  name: string;
  harness: string;
  home: string;
  workspace: string;
  marker: string;
}

export interface WorkerConfiguration {
  home: string;
  databaseUrl: string;
  attemptId: string;
  token: string;
  hostId: string;
  sessionId: string;
  parentSessionId: string;
  workspace: string;
  expectedMarker: string;
  result: Record<string, unknown>;
  skipStartReportForCrashSimulation?: boolean;
}

export interface WorkerMessage {
  type: string;
  pid: number;
  [key: string]: unknown;
}

export function cliEnvironment(databaseUrl: string): Record<string, string> {
  // No service credentials or model API keys are needed or forwarded to workers.
  const environment: Record<string, string> = {
    SENDEROS_DATABASE_URL: databaseUrl,
    BUN_OPTIONS: '--no-env-file',
    PATH: process.env.PATH ?? '',
    HOME: process.env.HOME ?? '/tmp',
    CI: 'true',
  };
  for (const name of ['TMPDIR', 'TMP', 'TEMP', 'SENDEROS_TEST_RUNTIME_ROOT']) {
    if (process.env[name]) environment[name] = process.env[name]!;
  }
  return environment;
}

export async function invokeCli<T = any>(
  home: string,
  databaseUrl: string,
  args: string[],
  cwd = repositoryRoot,
): Promise<CliResponse<T>> {
  const child = Bun.spawn({
    cmd: [process.execPath, cliEntry, ...args, '--home', home],
    cwd,
    env: cliEnvironment(databaseUrl),
    stdin: 'ignore',
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  let value: T;
  try {
    value = JSON.parse(stdout.trim() || stderr.trim() || 'null') as T;
  } catch {
    throw new Error(`CLI returned non-JSON output (${exitCode}): ${stdout}\n${stderr}`);
  }
  return { exitCode, value, stderr };
}

export async function successfulCli<T = any>(
  home: string,
  databaseUrl: string,
  args: string[],
  cwd = repositoryRoot,
): Promise<T> {
  const response = await invokeCli<T>(home, databaseUrl, args, cwd);
  if (response.exitCode !== 0) {
    // Avoid reflecting command arguments: they can contain an ownership token.
    throw new Error(`CLI ${args[0]} ${args[1] ?? ''} failed (${response.exitCode}): ${JSON.stringify(response.value)}`);
  }
  return response.value;
}
