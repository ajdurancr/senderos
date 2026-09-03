import { getAgent, listAgents } from '@senderos/senderos';
import { requirePositional } from '../shared';

const agentListHelp = {
  command: 'list',
  summary: 'List Senderos agents.',
  agentDescription:
    'Use this to inspect the persisted agent records that planning and run dispatch can reference. This is a read-only inspection surface.',
  usage: ['senderos agent list'],
};

const agentShowHelp = {
  command: 'show',
  summary: 'Show a Senderos agent.',
  agentDescription:
    'Use this to inspect one agent definition in detail, including its current persisted runtime fields.',
  usage: ['senderos agent show <agent-id>'],
  arguments: [
    { name: 'agent-id', description: 'Agent identifier.', required: true },
  ],
};

export const agentCommandHelp = {
  command: 'agent',
  summary: 'Inspect Senderos agents.',
  agentDescription:
    'Use the agent command to inspect runtime agent definitions that can participate in planning and dispatch. It is read-only and does not perform execution work.',
  usage: ['senderos agent <list|show> ...'],
  subcommands: [agentListHelp, agentShowHelp],
};

export function handleAgent(
  sub: string | undefined,
  positionals: string[],
  home: string,
) {
  switch (sub) {
    case 'list':
      return listAgents(home);
    case 'show':
      return getAgent(requirePositional(positionals[2], 'agent id'), home);
    default:
      throw new Error('Unknown agent action');
  }
}
