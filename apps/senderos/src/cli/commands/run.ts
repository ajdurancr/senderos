import { getRun } from '../../services/runs';
import { cancelRun, listRuns, showLoop, startLoop, tickLoop } from '../../services/runtime';
import { requirePositional } from '../shared';

const runStartHelp = {
  command: 'start',
  summary: 'Start a run for a feature, optionally binding it to a specific sendero and agent.',
  usage: [
    'senderos run start --feature-id <feature-id> [--sendero-id <sendero-id>] [--agent-id <agent-id>]',
    'senderos run --feature-id <feature-id> --sendero-id <sendero-id> --agent-id <agent-id>',
  ],
};

const runAdvanceHelp = {
  command: 'advance',
  summary: 'Advance an active feature run to the next phase.',
  usage: ['senderos run advance <feature-id>', 'senderos run advance --feature-id <feature-id>'],
};

const runStateHelp = {
  command: 'state',
  summary: 'Show current run state for a feature.',
  usage: ['senderos run state <feature-id>', 'senderos run state --feature-id <feature-id>'],
};

const runListHelp = {
  command: 'list',
  summary: 'List Senderos runs.',
  usage: ['senderos run list'],
};

const runShowHelp = {
  command: 'show',
  summary: 'Show a persisted Senderos run record.',
  usage: ['senderos run show <run-id>'],
  arguments: [{ name: 'run-id', description: 'Run identifier.', required: true }],
};

const runCancelHelp = {
  command: 'cancel',
  summary: 'Cancel a Senderos run.',
  usage: ['senderos run cancel <run-id>'],
  arguments: [{ name: 'run-id', description: 'Run identifier.', required: true }],
};

export const runCommandHelp = {
  command: 'run',
  summary: 'Create, inspect, advance, and cancel Senderos runs.',
  usage: ['senderos run <start|advance|state|list|show|cancel> ...'],
  subcommands: [runStartHelp, runAdvanceHelp, runStateHelp, runListHelp, runShowHelp, runCancelHelp],
};

function featureIdForRun(positionals: string[], options: Record<string, string | boolean>) {
  return String(options['feature-id'] ?? positionals[2] ?? '');
}

export function handleRun(
  sub: string | undefined,
  positionals: string[],
  options: Record<string, string | boolean>,
  home: string
) {
  if (!sub || sub.startsWith('--')) {
    return startLoop(
      requirePositional(String(options['feature-id'] ?? ''), 'feature id'),
      home,
      {
        senderoId: options['sendero-id'] as string | undefined,
        agentId: options['agent-id'] as string | undefined,
      }
    );
  }

  switch (sub) {
    case 'start':
      return startLoop(requirePositional(featureIdForRun(positionals, options), 'feature id'), home, {
        senderoId: options['sendero-id'] as string | undefined,
        agentId: options['agent-id'] as string | undefined,
      });
    case 'advance':
      return tickLoop(requirePositional(featureIdForRun(positionals, options), 'feature id'), home);
    case 'state':
      return showLoop(requirePositional(featureIdForRun(positionals, options), 'feature id'), home);
    case 'list':
      return listRuns(home);
    case 'show':
      return getRun(requirePositional(positionals[2], 'run id'), home);
    case 'cancel':
      return cancelRun(requirePositional(positionals[2], 'run id'), home);
    default:
      throw new Error('Unknown run action');
  }
}
