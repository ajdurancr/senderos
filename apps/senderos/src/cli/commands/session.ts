import { getSession } from '../../services/sendero-supervisor';
import { listSessions, resumeSession } from '../../services/runtime';
import { requirePositional } from '../shared';

const sessionListHelp = {
  command: 'list',
  summary: 'List Senderos sessions.',
  agentDescription:
    'Use this to inspect the persisted external session records that runs are linked to. This is a diagnostic/runtime inspection surface rather than a planning surface.',
  usage: ['senderos session list'],
};

const sessionShowHelp = {
  command: 'show',
  summary: 'Show a Senderos session.',
  agentDescription:
    'Use this to inspect one persisted session record by id, including its status snapshot and resume details.',
  usage: ['senderos session show <session-id>'],
  arguments: [{ name: 'session-id', description: 'Session identifier.', required: true }],
};

const sessionResumeHelp = {
  command: 'resume',
  summary: 'Resume a Senderos session record.',
  agentDescription:
    'Use this only when you already know a session exists and need the persisted resume details that Senderos recorded for it.',
  usage: ['senderos session resume <session-id>'],
  arguments: [{ name: 'session-id', description: 'Session identifier.', required: true }],
};

export const sessionCommandHelp = {
  command: 'session',
  summary: 'Inspect Senderos session records.',
  agentDescription:
    'Use the session command for runtime inspection of external execution sessions. It does not plan work or create new runs.',
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
