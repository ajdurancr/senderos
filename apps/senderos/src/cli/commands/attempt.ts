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
  sub: string | undefined,
  p: string[],
  o: Record<string, string | boolean | string[]>,
  home: string,
) {
  switch (sub) {
    case 'list':
      return listRunAttempts(o['run-id'] as string | undefined, home);
    case 'show':
      return getAttempt(requirePositional(p[2], 'attempt id'), home);
    case 'resume':
      return resumeAttempt(requirePositional(p[2], 'attempt id'), home);
    default:
      throw new Error('Unknown attempt action');
  }
}
