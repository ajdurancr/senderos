import { getRun } from '../../services/loop';
import { cancelRun, listRuns } from '../../services/runtime';
import { requirePositional } from '../shared';

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
