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
  usage: ['senderos <command> [options]'],
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

export function resolveHelp(command?: string): CommandHelp {
  if (!command) return rootHelp;
  return rootHelp.subcommands?.find((entry) => entry.command === command) ?? rootHelp;
}
