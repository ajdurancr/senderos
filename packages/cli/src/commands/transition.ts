import {
  createAgentTransition,
  getAgentTransition,
  listAgentTransitions,
  listAgentTransitionsForAgent,
} from '@senderos/senderos';
import { requirePositional } from '../shared';
export const transitionCommandHelp = {
  command: 'transition',
  summary: 'Create and inspect agent transitions.',
  usage: ['senderos transition <create|list|show> ...'],
  subcommands: [
    {
      command: 'create',
      summary: 'Create an agent transition.',
      usage: [
        'senderos transition create --source-agent-id <agent-id> --name <name> --objective <objective>',
      ],
    },
    {
      command: 'list',
      summary: 'List agent transitions.',
      usage: ['senderos transition list [--agent-id <agent-id>]'],
    },
    {
      command: 'show',
      summary: 'Show an agent transition.',
      usage: ['senderos transition show <transition-id>'],
    },
  ],
};
export function handleTransition(
  subcommand: string | undefined,
  positionals: string[],
  options: Record<string, string | boolean | string[]>,
  home: string,
) {
  switch (subcommand) {
    case 'create':
      return createAgentTransition({
        home,
        sourceAgentId: String(options['source-agent-id'] ?? ''),
        targetAgentId: options['target-agent-id'] as string | undefined,
        name: String(options.name ?? ''),
        description: options.description as string | undefined,
        transitionObjective: String(options.objective ?? ''),
      });
    case 'list':
      return options['agent-id']
        ? listAgentTransitionsForAgent(String(options['agent-id']), home)
        : listAgentTransitions(home);
    case 'show':
      return getAgentTransition(
        requirePositional(positionals[2], 'transition id'),
        home,
      );
    default:
      throw new Error('Unknown transition action');
  }
}
