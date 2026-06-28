import { showLoop, startLoop, tickLoop } from '../../services/runtime';
import { requirePositional } from '../shared';

export const loopCommandHelp = {
  command: 'loop',
  summary: 'Operate the loop-engineering workflow for a feature.',
  usage: [
    'senderos loop start <feature-id>',
    'senderos loop tick <feature-id>',
    'senderos loop show <feature-id>',
  ],
};

export function handleLoop(sub: string | undefined, positionals: string[], home: string) {
  const featureId = requirePositional(positionals[2], 'feature id');

  switch (sub) {
    case 'start':
    case 'resume':
      return startLoop(featureId, home);
    case 'tick':
      return tickLoop(featureId, home);
    case 'show':
      return showLoop(featureId, home);
    default:
      throw new Error('Unknown loop action');
  }
}
