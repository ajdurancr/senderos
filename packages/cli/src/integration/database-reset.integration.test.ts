import { beforeAll, expect, test } from 'bun:test';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tempHome } from '../../../core/src/test-support/runtime';
import { runTerminal, testEnvironment, verifyTerminalSupport } from './terminal-fixture';

beforeAll(verifyTerminalSupport);

const entry = resolve(import.meta.dir, '../index.ts');
function environment(home: string) {
  return testEnvironment({ SENDEROS_DATABASE_URL: `file:${join(home, 'senderos.db')}`, RESET_TEST_DATABASE_URL: `file:${join(home, 'senderos.db')}` });
}
function cli(home: string, args: string[], env = environment(home)) {
  const result = Bun.spawnSync([process.execPath, entry, ...args, '--home', home], {
    env, stdin: 'ignore', stdout: 'pipe', stderr: 'pipe', timeout: 10_000,
  });
  expect(result.exitCode, result.stderr.toString()).toBe(0);
  return JSON.parse(result.stdout.toString());
}
function setup() {
  const home = tempHome();
  cli(home, ['init', '--name', 'Reset integration context', '--harness', 'codex', '--approve']);
  return home;
}
function snapshot(home: string) {
  return {
    entries: readdirSync(home).sort(),
    bytes: Object.fromEntries(readdirSync(home).filter(name => name === 'config.json' || name.startsWith('senderos.db')).sort().map(name => [name, readFileSync(join(home, name)).toString('base64')])),
  };
}
async function interactive(home: string, answer: string | null, options: {
  env?: NodeJS.ProcessEnv;
  beforeAnswer?: () => void | Promise<void>;
  rawInput?: string;
  expectPrompt?: boolean;
} = {}) {
  return runTerminal([process.execPath, entry, 'db', 'reset', '--home', home], {
    env: options.env ?? environment(home),
    prompt: options.expectPrompt === false ? undefined : 'or press Enter to cancel:',
    beforeInput: options.beforeAnswer,
    input: options.rawInput ?? (answer === null ? '\x04' : `${answer}\n`),
  });
}

test('real terminal confirmation resets custom-config DB, retains backup and preserves non-DB files', async () => {
  const home = setup();
  const project = cli(home, ['project', 'create', '--name', 'Disposable project']);
  cli(home, ['goal', 'create', '--project-id', project.id, '--title', 'Disposable draft']);
  cli(home, ['agent', 'create', '--slug', 'reset-custom', '--name', 'Custom', '--instructions', 'Disposable instructions.']);
  cli(home, ['host', 'register', 'reset-host', '--name', 'Disposable host', '--capability', 'independent_session']);
  const config = JSON.parse(readFileSync(join(home, 'config.json'), 'utf8'));
  config.database.urlEnv = 'RESET_TEST_DATABASE_URL';
  writeFileSync(join(home, 'config.json'), `\n${JSON.stringify(config, null, 4)}\n`);
  const preserved = ['config.json', '.env', 'artifacts/retained.txt', 'logs/retained.txt'];
  for (const path of preserved.slice(1)) writeFileSync(join(home, path), `keep ${path}\n`);
  const before = preserved.map(path => readFileSync(join(home, path)));
  const result = await interactive(home, `RESET ${join(home, 'senderos.db')}`, { env: { ...environment(home), SENDEROS_DATABASE_URL: 'libsql://must-not-connect.invalid' } });
  expect(result.exitCode, result.output).toBe(0);
  expect(result.output).toContain('"reset": true');
  expect(result.output).toContain('RESET_TEST_DATABASE_URL');
  expect(result.output).toContain('backupPath');
  expect(cli(home, ['project', 'list'])).toEqual([]);
  expect(cli(home, ['goal', 'list'])).toEqual([]);
  expect(cli(home, ['host', 'list'])).toEqual([]);
  expect(cli(home, ['agent', 'list']).some((agent: { slug: string }) => agent.slug === 'reset-custom')).toBe(false);
  expect(cli(home, ['sendero', 'list'])).toHaveLength(5);
  expect(cli(home, ['doctor']).ok).toBe(true);
  expect(JSON.parse(readFileSync(join(home, 'config.json'), 'utf8')).executionContextId).toBe(config.executionContextId);
  for (const [index, path] of preserved.entries()) expect(readFileSync(join(home, path))).toEqual(before[index]);
  const backupMatch = result.output.match(/"backupPath":\s*"([^"\r\n]+)"/);
  expect(backupMatch).not.toBeNull();
  expect(existsSync(backupMatch![1]!)).toBe(true);
});

test('real terminal decline, EOF and piped affirmative input never mutate the target', async () => {
  const home = setup();
  const before = snapshot(home);
  for (const answer of ['', 'yes', 'RESET another-file', null]) {
    const result = await interactive(home, answer);
    expect(result.exitCode, result.output).toBe(0);
    expect(result.output).toContain('"reset": false');
    expect(snapshot(home)).toEqual(before);
  }
  const result = Bun.spawnSync([process.execPath, entry, 'db', 'reset', '--home', home], {
    env: environment(home), stdin: Buffer.from(`RESET ${join(home, 'senderos.db')}\n`), stdout: 'pipe', stderr: 'pipe', timeout: 10_000,
  });
  expect(result.exitCode).toBe(1);
  expect(result.stderr.toString()).toContain('interactive terminal');
  expect(snapshot(home)).toEqual(before);
  const interrupted = await interactive(home, '\x03');
  expect(interrupted.signalCode, interrupted.output).toBe('SIGINT');
  expect(snapshot(home)).toEqual(before);
  const partialEof = await interactive(home, null, { rawInput: `RESET ${join(home, 'senderos.db')}\x04\x04` });
  expect(partialEof.exitCode, partialEof.output).toBe(0);
  expect(partialEof.output).toContain('"reset": false');
  expect(snapshot(home)).toEqual(before);
});

test('real CLI rejects remote URLs before confirmation and does not disclose credentials', async () => {
  const home = setup();
  const before = snapshot(home);
  const result = await interactive(home, 'yes', { expectPrompt: false, env: { ...environment(home), SENDEROS_DATABASE_URL: 'libsql://private.example?authToken=do-not-print-me' } });
  expect(result.exitCode).toBe(1);
  expect(result.prompted).toBe(false);
  expect(result.output).not.toContain('or press Enter to cancel:');
  expect(result.output).toContain('Reset supports only an explicit absolute local SQLite file URL.');
  expect(result.output).not.toContain('do-not-print-me');
  expect(snapshot(home)).toEqual(before);
});

test('real CLI refuses active work instead of deleting coordination state', async () => {
  const home = setup();
  const project = cli(home, ['project', 'create', '--name', 'Active project']);
  const goal = cli(home, ['goal', 'create', '--project-id', project.id, '--title', 'Active objective', '--sendero-version-id', 'sendero-software-delivery-v1']);
  cli(home, ['goal', 'activate', goal.id]);
  cli(home, ['run', 'dispatch', '--goal-id', goal.id, '--request-id', 'before-reset']);
  const result = await interactive(home, `RESET ${join(home, 'senderos.db')}`);
  expect(result.exitCode, result.output).toBe(1);
  expect(result.output).toContain('Reset refused: active runs exist across execution contexts.');
  expect(cli(home, ['project', 'list'])).toHaveLength(1);
  expect(cli(home, ['run', 'list'])).toHaveLength(1);
});

test('real CLI refuses a target/config change made while confirmation is pending', async () => {
  const home = setup();
  const database = readFileSync(join(home, 'senderos.db'));
  const result = await interactive(home, `RESET ${join(home, 'senderos.db')}`, {
    beforeAnswer() {
      const config = readFileSync(join(home, 'config.json'), 'utf8');
      writeFileSync(join(home, 'config.json'), `${config}\n`);
    },
  });
  expect(result.exitCode, result.output).toBe(1);
  expect(result.output).toContain('Reset target or configuration changed since confirmation.');
  expect(readFileSync(join(home, 'senderos.db'))).toEqual(database);
});

test('two confirmed real CLI processes cannot both replace the same approved database', async () => {
  const home = setup();
  let waiting = 0;
  let release!: () => void;
  const barrier = new Promise<void>(resolve => { release = resolve; });
  const beforeAnswer = () => { if (++waiting === 2) release(); return barrier; };
  // Reap both children before fixture cleanup, including a missing-prompt failure.
  const settled = await Promise.allSettled([
    interactive(home, `RESET ${join(home, 'senderos.db')}`, { beforeAnswer }),
    interactive(home, `RESET ${join(home, 'senderos.db')}`, { beforeAnswer }),
  ]);
  const results = settled.map(result => {
    if (result.status === 'rejected') throw result.reason;
    return result.value;
  });
  expect(results.map(result => result.exitCode).sort(), results.map(result => result.output).join('\n')).toEqual([0, 1]);
  expect(results.filter(result => result.output.includes('"reset": true'))).toHaveLength(1);
  expect(results.every(result => result.prompted)).toBe(true);
  const refused = results.find(result => result.exitCode === 1)!;
  expect(refused.output).toMatch(/Database reset lock exists:|Reset target or configuration changed|EEXIST[^\r\n]*senderos-reset\.lock/);
  expect(cli(home, ['doctor']).ok).toBe(true);
  expect(readdirSync(home).some(name => name.endsWith('.senderos-reset.lock'))).toBe(false);
});
