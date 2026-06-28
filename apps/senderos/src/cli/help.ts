import type { CommandHelp } from '../domain/types';

import { configCommandHelp } from './commands/config';
import { featureCommandHelp } from './commands/feature';
import { initCommandHelp } from './commands/init';
import { loopCommandHelp } from './commands/loop';
import { runCommandHelp } from './commands/run';
import { sessionCommandHelp } from './commands/session';
import { systemCommandsHelp } from './commands/system';

export const rootHelp: CommandHelp = {
  command: 'senderos',
  summary: 'SQLite-backed control plane for Senderos loop engineering.',
  usage: ['senderos <command> [subcommand] [arguments] [options]'],
  arguments: [
    { name: 'command', description: 'Top-level command to execute.', required: true },
    { name: 'subcommand', description: 'Nested action for grouped commands when applicable.' },
  ],
  subcommands: [
    initCommandHelp,
    configCommandHelp,
    featureCommandHelp,
    loopCommandHelp,
    runCommandHelp,
    sessionCommandHelp,
    ...systemCommandsHelp,
  ],
};

export function resolveHelp(command?: string, subcommand?: string): CommandHelp {
  if (!command) {
    return rootHelp;
  }

  const commandHelp = rootHelp.subcommands?.find((entry) => entry.command === command);

  if (!commandHelp) {
    return rootHelp;
  }

  if (!subcommand) {
    return commandHelp;
  }

  return commandHelp.subcommands?.find((entry) => entry.command === subcommand) ?? commandHelp;
}

export function collectHelpLeaves(help: CommandHelp): CommandHelp[] {
  const children = help.subcommands ?? [];

  if (!children.length) {
    return [help];
  }

  return [help, ...children.flatMap(collectHelpLeaves)];
}
