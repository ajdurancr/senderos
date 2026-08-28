import {
  createAgentTransition,
  getAgentTransition,
  listAgentTransitions,
  listAgentTransitionsForAgent,
} from '../../services/runtime';
import { requirePositional } from '../shared';
export const transitionCommandHelp = {
  command: 'transition',
  summary: 'Create and inspect agent transitions.',
  usage: ['senderos transition <create|list|show> ...'],
};
export function handleTransition(
  sub: string | undefined,
  p: string[],
  o: Record<string, string | boolean | string[]>,
  home: string,
) {
  switch (sub) {
    case 'create':
      return createAgentTransition({
        home,
        sourceAgentId: String(o['source-agent-id'] ?? ''),
        targetAgentId: o['target-agent-id'] as string | undefined,
        name: String(o.name ?? ''),
        description: o.description as string | undefined,
        transitionObjective: String(o.objective ?? ''),
      });
    case 'list':
      return o['agent-id']
        ? listAgentTransitionsForAgent(String(o['agent-id']), home)
        : listAgentTransitions(home);
    case 'show':
      return getAgentTransition(requirePositional(p[2], 'transition id'), home);
    default:
      throw new Error('Unknown transition action');
  }
}
