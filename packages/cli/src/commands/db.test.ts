import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { createProject, listProjects, loadConfig } from '@senderos/core';
import { initHome } from '../../../core/src/test-support/runtime';
import { confirmDatabaseReset, handleDatabase } from './db';
import { runCli } from '../run';

function terminal(answer: string | undefined, tty = true) {
  const input = Object.assign(new PassThrough(), { isTTY: tty });
  const output = Object.assign(new PassThrough(), { isTTY: tty });
  let text = '';
  output.on('data', chunk => { text += chunk.toString(); });
  setImmediate(() => input.end(answer === undefined ? undefined : `${answer}\n`));
  return { input, output, text: () => text };
}

test('confirmation is terminal-only, exact, and defaults to decline on empty input or EOF', async () => {
  await expect(confirmDatabaseReset('RESET target', terminal('RESET target', false))).rejects.toThrow('interactive terminal');
  for (const answer of [undefined, '', 'yes', 'RESET other', 'RESET target '])
    expect(await confirmDatabaseReset('RESET target', terminal(answer))).toBe(false);
  expect(await confirmDatabaseReset('RESET target', terminal('RESET target'))).toBe(true);
  const eof = terminal(undefined);
  eof.input.write('RESET target');
  expect(await confirmDatabaseReset('RESET target', eof)).toBe(false);
  const overlong = terminal(undefined);
  overlong.input.write('RESET target extra');
  expect(await confirmDatabaseReset('RESET target', overlong)).toBe(false);
});

test('db reset rejects unsupported actions, extra arguments and automation flags', async () => {
  for (const sub of [undefined, 'delete'])
    await expect(handleDatabase(sub, ['db', String(sub)], {}, '/unused')).rejects.toThrow('Usage:');
  await expect(handleDatabase('reset', ['db', 'reset', 'extra'], {}, '/unused')).rejects.toThrow('Usage:');
  await expect(handleDatabase('reset', ['db', 'reset'], { yes: true }, '/unused')).rejects.toThrow('only accepts');
});

test('declined reset previews the exact configured target and leaves bytes untouched', async () => {
  const home = await initHome();
  const dbPath = join(home, 'senderos.db');
  const before = readFileSync(dbPath);
  const config = readFileSync(join(home, 'config.json'));
  const io = terminal('no');
  expect(await handleDatabase('reset', ['db', 'reset'], { home }, home, io)).toMatchObject({ reset: false, databasePath: dbPath });
  expect(io.text()).toContain(JSON.stringify(dbPath));
  expect(io.text()).toContain('ALL contexts');
  expect(io.text()).toContain('STOP Studio');
  expect(readFileSync(dbPath)).toEqual(before);
  expect(readFileSync(join(home, 'config.json'))).toEqual(config);
});

test('accepted reset clears records while retaining the configured context and exact config bytes', async () => {
  const home = await initHome();
  await createProject({ home, name: 'Disposable project' });
  const config = readFileSync(join(home, 'config.json'));
  const contextId = loadConfig(home).executionContextId;
  const result = await handleDatabase('reset', ['db', 'reset'], {}, home, terminal(`RESET ${join(home, 'senderos.db')}`));
  expect(result.reset).toBe(true);
  expect(await listProjects(home)).toEqual([]);
  expect(loadConfig(home).executionContextId).toBe(contextId);
  expect(readFileSync(join(home, 'config.json'))).toEqual(config);
});

test('runCli routes db reset and fails closed without an interactive terminal', async () => {
  const home = await initHome();
  const previous = process.exitCode;
  const errors: string[] = [];
  const error = console.error;
  console.error = (...values: unknown[]) => { errors.push(values.join(' ')); };
  try {
    await runCli(['db', 'reset', '--home', home]);
    expect(process.exitCode).toBe(1);
    expect(errors.join('\n')).toContain('interactive terminal');
  } finally {
    process.exitCode = previous ?? 0;
    console.error = error;
  }
});
