import { expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { testEnvironment } from '../../../../scripts/test-environment';

const root = resolve(import.meta.dir, '../../../..');

function fixture(check: (directory: string, databaseUrl: string) => void) {
  const directory = mkdtempSync(join(process.env.SENDEROS_TEST_RUNTIME_ROOT ?? tmpdir(), 'environment-regression-'));
  try {
    const outside = join(directory, 'outside');
    mkdirSync(outside);
    const databasePath = join(outside, 'senderos.db');
    const databaseUrl = `file:${databasePath}`;
    const db = new Database(databasePath);
    db.exec("CREATE TABLE sentinel (value TEXT); INSERT INTO sentinel VALUES ('disposable fixture only')");
    db.close();
    const before = readFileSync(databasePath);
    const entries = readdirSync(outside);
    for (const name of ['.env', '.env.test', '.env.local', '.env.test.local']) {
      writeFileSync(join(directory, name), `SENDEROS_DATABASE_URL=${databaseUrl}\nSENDEROS_DATABASE_AUTH_TOKEN=dotenv-fixture-token\nSENDEROS_DOTENV_REGRESSION=loaded\n`);
    }
    check(directory, databaseUrl);
    expect(readFileSync(databasePath)).toEqual(before);
    expect(readdirSync(outside)).toEqual(entries);
  } finally { rmSync(directory, { recursive: true, force: true }); }
}

test('test environments omit inherited credentials without reading their values', () => {
  const inherited = { PATH: '/fixture/bin' };
  for (const name of ['SENDEROS_DATABASE_URL', 'SENDEROS_DATABASE_AUTH_TOKEN', 'BUN_OPTIONS']) {
    Object.defineProperty(inherited, name, { enumerable: true, get() { throw new Error(`Must not read inherited ${name}`); } });
  }
  expect(testEnvironment({}, inherited)).toEqual({ PATH: '/fixture/bin', NO_COLOR: '1', BUN_OPTIONS: '--no-env-file' });
  expect(testEnvironment({ SENDEROS_DATABASE_URL: 'file:/disposable/explicit.db' }, inherited).SENDEROS_DATABASE_URL).toBe('file:/disposable/explicit.db');
});

test('test runner and host subprocesses cannot reload database settings from dotenv', () => {
  fixture((directory, databaseUrl) => {
    const probe = `
      if (process.env.SENDEROS_DATABASE_URL !== process.argv[1] ||
          process.env.SENDEROS_DATABASE_AUTH_TOKEN !== undefined ||
          process.env.SENDEROS_DOTENV_REGRESSION !== undefined)
        throw new Error('Test subprocess inherited or reloaded database settings');
      console.log('isolated subprocess verified');
    `;
    const cases = [
      {
        command: [process.execPath, '--no-env-file', join(root, 'scripts/run-with-test-runtime.ts'), process.execPath, '-e', probe],
        env: testEnvironment({ SENDEROS_DATABASE_URL: databaseUrl, SENDEROS_DATABASE_AUTH_TOKEN: 'inherited-fixture-token' }),
      },
      {
        // Exercise the host's environment builder in its own process, as the
        // simulator does, without adding host-only code to CLI coverage.
        command: [process.execPath, '-e', `
          import { cliEnvironment } from ${JSON.stringify(join(root, 'examples/external-host/protocol.ts'))};
          const child = Bun.spawnSync([process.execPath, '-e', ${JSON.stringify(probe)}, process.argv[1]], {
            env: cliEnvironment(process.argv[1]), stdin: 'ignore', stdout: 'inherit', stderr: 'inherit',
          });
          process.exit(child.exitCode);
        `, databaseUrl],
        env: testEnvironment(),
      },
    ];
    for (const scenario of cases) {
      const result = Bun.spawnSync(scenario.command, {
        cwd: directory, env: scenario.env, stdin: 'ignore', stdout: 'pipe', stderr: 'pipe', timeout: 10_000,
      });
      expect(result.exitCode, result.stderr.toString()).toBe(0);
      expect(result.stdout.toString()).toContain('isolated subprocess verified');
    }
  });
});

test('the complete CLI workflow isolates an inherited outside-home database and token', () => {
  fixture((directory, databaseUrl) => {
    const result = Bun.spawnSync([
      process.execPath, '--no-env-file', 'test', '--isolate',
      '--test-name-pattern', '^fresh CLI initialization',
      join(import.meta.dir, 'cli-workflows.integration.test.ts'),
    ], {
      cwd: directory,
      env: testEnvironment({
        SENDEROS_DATABASE_URL: databaseUrl,
        SENDEROS_DATABASE_AUTH_TOKEN: 'inherited-fixture-token',
        SENDEROS_TEST_RUNTIME_ROOT: join(directory, 'workflow-runtime'),
      }),
      stdin: 'ignore', stdout: 'pipe', stderr: 'pipe', timeout: 10_000,
    });
    expect(result.exitCode, result.stderr.toString()).toBe(0);
    expect(result.stderr.toString()).toContain('1 pass');
  });
});
