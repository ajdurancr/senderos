import { previewLocalDatabaseReset, resetLocalDatabase } from '@senderos/core';
import type { Readable, Writable } from 'node:stream';

type Terminal = {
  input: Readable & { isTTY?: boolean };
  output: Writable & { isTTY?: boolean };
};

export const dbCommandHelp = {
  command: 'db',
  summary: 'Maintain the configured local Senderos database.',
  agentDescription: 'Database reset is destructive, interactive-only maintenance. Stop every writer first; never automate confirmation or use it to recover active work.',
  usage: ['senderos db reset --home /absolute/path/.senderos'],
  subcommands: [{
    command: 'reset',
    summary: 'Confirm and replace a local database with fresh migrations and built-in seeds.',
    agentDescription: 'Reads config.json and its database.urlEnv environment variable. Requires an existing local file, a terminal and an exact path-specific confirmation. Clears every execution context in that database, then restores only this configured context. Keeps a recovery backup and preserves config, artifacts, logs and repository files. Refuses active work and unsafe targets. There is no --yes or --force option.',
    usage: ['senderos db reset --home /absolute/path/.senderos'],
    options: [{ name: '--home', description: 'Existing Senderos home containing config.json. Defaults to .senderos in the current working directory.' }],
  }],
};

/** EOF, Ctrl-C and any answer other than the complete phrase decline safely. */
export async function confirmDatabaseReset(phrase: string, terminal: Terminal) {
  if (!terminal.input.isTTY || !terminal.output.isTTY) {
    throw new Error('Database reset requires an interactive terminal on stdin and stderr. Piped input, --yes and --force are not supported.');
  }
  terminal.output.write(`Type ${JSON.stringify(phrase)} to continue, or press Enter to cancel: `);
  let input = Buffer.alloc(0);
  for await (const chunk of terminal.input) {
    input = Buffer.concat([input, Buffer.from(chunk)]);
    const newline = input.findIndex(byte => byte === 10 || byte === 13);
    if (newline !== -1) return input.subarray(0, newline).toString('utf8') === phrase;
    if (input.length > Buffer.byteLength(phrase)) return false;
  }
  return false;
}

export async function handleDatabase(
  sub: string | undefined,
  positionals: string[],
  options: Record<string, string | boolean | string[]>,
  home: string,
  terminal: Terminal = { input: process.stdin, output: process.stderr },
) {
  if (sub !== 'reset' || positionals.length !== 2) throw new Error('Usage: senderos db reset [--home <path>]');
  if (Object.keys(options).some(key => key !== 'home')) throw new Error('Database reset only accepts --home; --yes and --force are not supported.');
  const preview = previewLocalDatabaseReset(home);
  terminal.output.write([
    'LOCAL DATABASE RESET',
    `Database: ${JSON.stringify(preview.databasePath)}`,
    `Configuration: ${JSON.stringify(preview.configPath)}`,
    `URL environment variable: ${JSON.stringify(preview.urlEnv)}`,
    `Context to restore: ${JSON.stringify(preview.executionContextId)}`,
    'This clears ALL contexts, projects, goals, runs, history, custom definitions, hosts and grants in this database.',
    'Fresh migrations and built-in agents/Senderos will be installed; only the configured context is restored.',
    'A recovery backup is retained. Config, .env, repositories, artifacts and logs are preserved.',
    'STOP Studio, host workers and schedulers first. This command cannot detect every external or older process.',
    'Schema, active-work and lock checks run after confirmation, before replacement.',
    '',
  ].join('\n'));
  const approved = await confirmDatabaseReset(`RESET ${preview.databasePath}`, terminal);
  if (!approved) return { reset: false, reason: 'Confirmation declined; nothing changed.', databasePath: preview.databasePath };
  return { reset: true, ...await resetLocalDatabase(home, preview) };
}
