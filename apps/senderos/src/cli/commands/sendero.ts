import { createSendero, getSendero, listSenderos, listSenderosForAgent } from '../../services/runtime';
import { requirePositional } from '../shared';

const senderoListHelp = {
  command: 'list',
  summary: 'List senderos, optionally scoped to one source agent.',
  agentDescription:
    'Use this to inspect the execution paths currently available in Senderos. Filter by agent when you need to know which senderos a specific source agent can dispatch through.',
  usage: ['senderos sendero list', 'senderos sendero list --agent-id <agent-id>'],
};

const senderoShowHelp = {
  command: 'show',
  summary: 'Show a sendero.',
  agentDescription:
    'Use this to inspect one sendero record, including its source agent, optional target agent, and persisted goal fields.',
  usage: ['senderos sendero show <sendero-id>'],
  arguments: [{ name: 'sendero-id', description: 'Sendero identifier.', required: true }],
};

const senderoCreateHelp = {
  command: 'create',
  summary: 'Create a sendero assigned to a source agent.',
  agentDescription:
    'Use this to persist a new sendero path in Senderos. This only creates orchestration state; it does not dispatch work.',
  usage: [
    'senderos sendero create --source-agent-id <agent-id> --name "Spec handoff" --goal "..." [--target-agent-id <agent-id>] [--description ...] [--goal-mode terminal|toward_agent]',
  ],
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
