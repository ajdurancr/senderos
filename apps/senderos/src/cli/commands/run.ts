import { getRun } from '../../services/loop';
import { cancelRun, listRuns } from '../../services/runtime';
import { requirePositional } from '../shared';

const runListHelp = {
  command: 'list',
  summary: 'List Senderos runs.',
  usage: ['senderos run list'],
};

const runShowHelp = {
  command: 'show',
  summary: 'Show a Senderos run.',
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
  summary: 'Inspect and manage Senderos runs.',
  usage: ['senderos run <list|show|cancel> ...'],
  subcommands: [runListHelp, runShowHelp, runCancelHelp],
};

export function handleRun(sub: string | undefined, positionals: string[], home: string) {
  switch (sub) {
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
