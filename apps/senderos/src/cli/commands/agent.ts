import {
  createAgentRun,
  createSendero,
  getAgent,
  getAgentRun,
  getSendero,
  listAgentRuns,
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

const agentRunListHelp = {
  command: 'list',
  summary: 'List agent runs, optionally scoped to an agent.',
  usage: ['senderos agent-run list', 'senderos agent-run list --agent-id <agent-id>'],
};

const agentRunShowHelp = {
  command: 'show',
  summary: 'Show an agent run.',
  usage: ['senderos agent-run show <agent-run-id>'],
  arguments: [{ name: 'agent-run-id', description: 'Agent run identifier.', required: true }],
};

const agentRunCreateHelp = {
  command: 'create',
  summary: 'Create an agent run record.',
  usage: [
    'senderos agent-run create --agent-id <agent-id> --goal "..." --harness codex [--sendero-id <sendero-id>] [--target-agent-id <agent-id>] [--status running] [--host-environment-name openclaw-main] [--host-environment-session-id abc123] [--checkpoint ...]',
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

export const agentRunCommandHelp = {
  command: 'agent-run',
  summary: 'Create and inspect agent execution records.',
  usage: ['senderos agent-run <create|list|show> ...'],
  subcommands: [agentRunCreateHelp, agentRunListHelp, agentRunShowHelp],
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

function parseAgentRunCreateOptions(home: string, options: Record<string, string | boolean>) {
  return {
    home,
    agentId: String(options['agent-id'] ?? ''),
    senderoId: (options['sendero-id'] as string | undefined) ?? null,
    targetAgentId: (options['target-agent-id'] as string | undefined) ?? null,
    featureId: (options['feature-id'] as string | undefined) ?? null,
    runId: (options['run-id'] as string | undefined) ?? null,
    goal: String(options.goal ?? ''),
    harness: String(options.harness ?? '') as any,
    status: options.status as any,
    hostEnvironmentName: (options['host-environment-name'] as string | undefined) ?? null,
    hostEnvironmentSessionId:
      (options['host-environment-session-id'] as string | undefined) ?? null,
    checkpoint: (options.checkpoint as string | undefined) ?? null,
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

export function handleAgentRun(
  sub: string | undefined,
  positionals: string[],
  options: Record<string, string | boolean>,
  home: string
) {
  switch (sub) {
    case 'create':
      return createAgentRun(parseAgentRunCreateOptions(home, options));
    case 'list':
      return listAgentRuns(options['agent-id'] ? String(options['agent-id']) : undefined, home);
    case 'show':
      return getAgentRun(requirePositional(positionals[2], 'agent run id'), home);
    default:
      throw new Error('Unknown agent-run action');
  }
}
