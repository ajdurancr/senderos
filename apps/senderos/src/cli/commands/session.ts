import { getSession } from '../../services/loop';
import { listSessions, resumeSession } from '../../services/runtime';
import { requirePositional } from '../shared';

export function handleSession(sub: string | undefined, positionals: string[], home: string) {
  switch (sub) {
    case 'list':
      return listSessions(home);
    case 'show':
      return getSession(requirePositional(positionals[2], 'session id'), home);
    case 'resume':
      return resumeSession(requirePositional(positionals[2], 'session id'), home);
    default:
      throw new Error('Unknown session action');
  }
}
