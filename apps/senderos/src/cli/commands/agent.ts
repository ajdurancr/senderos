import {
  createSendero,
  getAgent,
  getSendero,
  listAgents,
  listSenderos,
  listSenderosForAgent,
} from '../../services/runtime';
import { requirePositional } from '../shared';

const agentListHelp = {
  command: 'list',
  summary: 'List Senderos agents.',
  usage: ['senderos agent list'],
};

const agentShowHelp = {
  command: 'show',
  summary: 'Show a Senderos agent.',
  usage: ['senderos agent show <agent-id>'],
  arguments: [{ name: 'agent-id', description: 'Agent identifier.', required: true }],
};

const senderoListHelp = {
  command: 'list',
  summary: 'List senderos, optionally scoped to one source agent.',
  usage: ['senderos sendero list', 'senderos sendero list --agent-id <agent-id>'],
};

const senderoShowHelp = {
  command: 'show',
  summary: 'Show a sendero.',
  usage: ['senderos sendero show <sendero-id>'],
  arguments: [{ name: 'sendero-id', description: 'Sendero identifier.', required: true }],
};

const senderoCreateHelp = {
  command: 'create',
  summary: 'Create a sendero assigned to a source agent.',
  usage: [
    'senderos sendero create --source-agent-id <agent-id> --name "Spec handoff" --goal "..." [--target-agent-id <agent-id>] [--description ...] [--goal-mode terminal|toward_agent]',
  ],
};

export const agentCommandHelp = {
  command: 'agent',
  summary: 'Inspect Senderos agents.',
  usage: ['senderos agent <list|show> ...'],
  subcommands: [agentListHelp, agentShowHelp],
};

export const senderoCommandHelp = {
  command: 'sendero',
  summary: 'Create and inspect senderos.',
  usage: ['senderos sendero <create|list|show> ...'],
  subcommands: [senderoCreateHelp, senderoListHelp, senderoShowHelp],
};

function parseSenderoCreateOptions(home: string, options: Record<string, string | boolean>) {
  return {
    home,
    sourceAgentId: String(options['source-agent-id'] ?? ''),
    targetAgentId: (options['target-agent-id'] as string | undefined) ?? null,
    name: String(options.name ?? ''),
    description: (options.description as string | undefined) ?? '',
    goal: String(options.goal ?? ''),
    goalMode: options['goal-mode'] as any,
  };
}

export function handleAgent(sub: string | undefined, positionals: string[], home: string) {
  switch (sub) {
    case 'list':
      return listAgents(home);
    case 'show':
      return getAgent(requirePositional(positionals[2], 'agent id'), home);
    default:
      throw new Error('Unknown agent action');
  }
}

export function handleSendero(
  sub: string | undefined,
  positionals: string[],
  options: Record<string, string | boolean>,
  home: string
) {
  switch (sub) {
    case 'create':
      return createSendero(parseSenderoCreateOptions(home, options));
    case 'list':
      return options['agent-id']
        ? listSenderosForAgent(String(options['agent-id']), home)
        : listSenderos(home);
    case 'show':
      return getSendero(requirePositional(positionals[2], 'sendero id'), home);
    default:
      throw new Error('Unknown sendero action');
  }
}
