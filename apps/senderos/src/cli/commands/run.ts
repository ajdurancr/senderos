import { getRun } from '../../services/loop';
import { cancelRun, listRuns } from '../../services/runtime';
import { requirePositional } from '../shared';

export const runCommandHelp = {
  command: 'run',
  summary: 'Inspect and manage Senderos runs.',
  usage: [
    'senderos run list',
    'senderos run show <run-id>',
    'senderos run cancel <run-id>',
  ],
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
