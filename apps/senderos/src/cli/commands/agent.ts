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
  summary: 'List SenderOS agents.',
  agentDescription:
    'Use this to discover the persisted agent records that SenderOS can reference in plans, senderos, and run dispatches. This is the authoritative runtime list, not just the markdown seed files.',
  usage: ['senderos agent list'],
};

const agentShowHelp = {
  command: 'show',
  summary: 'Show a SenderOS agent.',
  agentDescription:
    'Use this to inspect one agent definition in detail, including its seeded metadata and persisted runtime fields.',
  usage: ['senderos agent show <agent-id>'],
  arguments: [{ name: 'agent-id', description: 'Agent identifier.', required: true }],
};

const senderoListHelp = {
  command: 'list',
  summary: 'List senderos, optionally scoped to one source agent.',
  agentDescription:
    'Use this to inspect the execution paths currently available in SenderOS. Filter by agent when you need to know which senderos a specific source agent can dispatch through.',
  usage: ['senderos sendero list', 'senderos sendero list --agent-id <agent-id>'],
};

const senderoShowHelp = {
  command: 'show',
  summary: 'Show a sendero.',
  agentDescription:
    'Use this to inspect one sendero record, including its source agent, optional target agent, and persisted goal metadata.',
  usage: ['senderos sendero show <sendero-id>'],
  arguments: [{ name: 'sendero-id', description: 'Sendero identifier.', required: true }],
};

const senderoCreateHelp = {
  command: 'create',
  summary: 'Create a sendero assigned to a source agent.',
  agentDescription:
    'Use this to persist a new sendero path in SenderOS. This only creates orchestration state; it does not start work or dispatch any agent session.',
  usage: [
    'senderos sendero create --source-agent-id <agent-id> --name "Spec handoff" --goal "..." [--target-agent-id <agent-id>] [--description ...] [--goal-mode terminal|toward_agent]',
  ],
};

export const agentCommandHelp = {
  command: 'agent',
  summary: 'Inspect SenderOS agents.',
  agentDescription:
    'Use the agent command to inspect runtime agent definitions that can participate in planning and dispatch. It is read-only and does not perform any execution work.',
  usage: ['senderos agent <list|show> ...'],
  subcommands: [agentListHelp, agentShowHelp],
};

export const senderoCommandHelp = {
  command: 'sendero',
  summary: 'Create and inspect senderos.',
  agentDescription:
    'Use the sendero command to define and inspect the persisted paths that features follow. This surface manages sendero state only.',
  usage: ['senderos sendero <create|list|show> ...'],
  subcommands: [senderoCreateHelp, senderoListHelp, senderoShowHelp],
};

function parseSenderoCreateOptions(home: string, options: Record<string, string | boolean | string[]>) {
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
  options: Record<string, string | boolean | string[]>,
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
