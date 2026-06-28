import { showLoop, startLoop, tickLoop } from '../../services/runtime';
import { requirePositional } from '../shared';

const loopStartHelp = {
  command: 'start',
  summary: 'Start the loop for a feature.',
  usage: ['senderos loop start <feature-id>'],
  arguments: [{ name: 'feature-id', description: 'Feature identifier.', required: true }],
};

const loopResumeHelp = {
  command: 'resume',
  summary: 'Resume the loop for a feature.',
  usage: ['senderos loop resume <feature-id>'],
  arguments: [{ name: 'feature-id', description: 'Feature identifier.', required: true }],
};

const loopTickHelp = {
  command: 'tick',
  summary: 'Advance the loop one step.',
  usage: ['senderos loop tick <feature-id>'],
  arguments: [{ name: 'feature-id', description: 'Feature identifier.', required: true }],
};

const loopShowHelp = {
  command: 'show',
  summary: 'Show loop state for a feature.',
  usage: ['senderos loop show <feature-id>'],
  arguments: [{ name: 'feature-id', description: 'Feature identifier.', required: true }],
};

export const loopCommandHelp = {
  command: 'loop',
  summary: 'Operate the loop-engineering workflow for a feature.',
  usage: ['senderos loop <start|resume|tick|show> <feature-id>'],
  subcommands: [loopStartHelp, loopResumeHelp, loopTickHelp, loopShowHelp],
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
