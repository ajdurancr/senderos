import { getSession } from '../../services/loop';
import { listSessions, resumeSession } from '../../services/runtime';
import { requirePositional } from '../shared';

const sessionListHelp = {
  command: 'list',
  summary: 'List Senderos sessions.',
  usage: ['senderos session list'],
};

const sessionShowHelp = {
  command: 'show',
  summary: 'Show a Senderos session.',
  usage: ['senderos session show <session-id>'],
  arguments: [{ name: 'session-id', description: 'Session identifier.', required: true }],
};

const sessionResumeHelp = {
  command: 'resume',
  summary: 'Resume a Senderos session record.',
  usage: ['senderos session resume <session-id>'],
  arguments: [{ name: 'session-id', description: 'Session identifier.', required: true }],
};

export const sessionCommandHelp = {
  command: 'session',
  summary: 'Inspect Senderos session records.',
  usage: ['senderos session <list|show|resume> ...'],
  subcommands: [sessionListHelp, sessionShowHelp, sessionResumeHelp],
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
