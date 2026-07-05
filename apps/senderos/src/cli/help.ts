import type { CommandHelp } from '../domain/types';

import { agentCommandHelp, senderoCommandHelp } from './commands/agent';
import { configCommandHelp } from './commands/config';
import { featureCommandHelp } from './commands/feature';
import { initCommandHelp } from './commands/init';
import { planCommandHelp } from './commands/plan';
import { projectCommandHelp } from './commands/project';
import { runCommandHelp } from './commands/run';
import { sessionCommandHelp } from './commands/session';
import { systemCommandsHelp } from './commands/system';

export const rootHelp: CommandHelp = {
  command: 'senderos',
  summary: 'SQLite-backed control plane for Senderos orchestration.',
  agentDescription:
    'Use SenderOS as a pure state and orchestration surface. Ask it for plans, inspect state, or mutate orchestration records, but do not expect it to execute the real coding work for you.',
  usage: ['senderos <command> [subcommand] [arguments] [options]'],
  arguments: [
    { name: 'command', description: 'Top-level command to execute.', required: true },
    { name: 'subcommand', description: 'Nested action for grouped commands when applicable.' },
  ],
  options: [
    { name: '--help', description: 'Print help for the current command or subcommand.' },
    { name: '--omit-agent-description', description: 'Hide the agent-focused execution guidance in help output.' },
  ],
  subcommands: [
    initCommandHelp,
    configCommandHelp,
    projectCommandHelp,
    agentCommandHelp,
    senderoCommandHelp,
    featureCommandHelp,
    planCommandHelp,
    runCommandHelp,
    sessionCommandHelp,
    ...systemCommandsHelp,
  ],
};

function stripAgentDescription(help: CommandHelp): CommandHelp {
  return {
    ...help,
    agentDescription: undefined,
    subcommands: help.subcommands?.map(stripAgentDescription),
  };
}

export function resolveHelp(
  command?: string,
  subcommand?: string,
  options?: { omitAgentDescription?: boolean }
): CommandHelp {
  const base = !command
    ? rootHelp
    : rootHelp.subcommands?.find((entry) => entry.command === command) ?? rootHelp;

  const resolved = !subcommand ? base : base.subcommands?.find((entry) => entry.command === subcommand) ?? base;

  return options?.omitAgentDescription ? stripAgentDescription(resolved) : resolved;
}

export function collectHelpLeaves(help: CommandHelp): CommandHelp[] {
  const children = help.subcommands ?? [];

  if (!children.length) {
    return [help];
  }

  return [help, ...children.flatMap(collectHelpLeaves)];
}
