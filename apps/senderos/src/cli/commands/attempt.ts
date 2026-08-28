import {
  getAttempt,
  listRunAttempts,
  resumeAttempt,
} from '../../services/runtime';
import { requirePositional } from '../shared';
export const attemptCommandHelp = {
  command: 'attempt',
  summary: 'Inspect concrete run attempts.',
  usage: ['senderos attempt <list|show|resume> ...'],
};
export function handleAttempt(
  subcommand: string | undefined,
  positionals: string[],
  options: Record<string, string | boolean | string[]>,
  home: string,
) {
  switch (subcommand) {
    case 'list':
      return listRunAttempts(options['run-id'] as string | undefined, home);
    case 'show':
      return getAttempt(requirePositional(positionals[2], 'attempt id'), home);
    case 'resume':
      return resumeAttempt(
        requirePositional(positionals[2], 'attempt id'),
        home,
      );
    default:
      throw new Error('Unknown attempt action');
  }
}
