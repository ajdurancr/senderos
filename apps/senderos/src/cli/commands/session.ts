import { getSession } from '../../services/loop';
import { listSessions, resumeSession } from '../../services/runtime';
import { requirePositional } from '../shared';

export const sessionCommandHelp = {
  command: 'session',
  summary: 'Inspect Senderos session records.',
  usage: [
    'senderos session list',
    'senderos session show <session-id>',
    'senderos session resume <session-id>',
  ],
};

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
