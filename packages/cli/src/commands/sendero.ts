import {
  addAgentToSendero,
  connectSenderoAgents,
  disconnectSenderoAgents,
  getSenderoGraph,
  listSenderos,
  listSenderoVersions,
  removeAgentFromSendero,
} from '@senderos/core';

import type { CliOptionValue } from '../args';
import { requirePositional } from '../shared';

export const senderoCommandHelp = {
  command: 'sendero',
  summary: 'Inspect and change versioned Senderos through intent-level actions.',
  agentDescription:
    'Use these commands to express graph intent. Refer to agents by slug or ID and to boundary nodes as start or end. Do not attempt low-level node or edge updates.',
  usage: ['senderos sendero <list|show|version|agent|connect|disconnect> ...'],
  subcommands: [
    { command: 'list', summary: 'List Senderos.', usage: ['senderos sendero list'] },
    {
      command: 'show',
      summary: 'Show one Sendero graph and its stable node and connection IDs.',
      usage: ['senderos sendero show <sendero-id-or-slug> [--version <number>]'],
    },
    {
      command: 'version',
      summary: 'Inspect Sendero versions.',
      usage: ['senderos sendero version list'],
      subcommands: [
        { command: 'list', summary: 'List persisted Sendero versions.', usage: ['senderos sendero version list'] },
      ],
    },
    {
      command: 'agent',
      summary: 'Add or remove an agent from a Sendero.',
      usage: [
        'senderos sendero agent add <sendero-id-or-slug> <agent-id-or-slug> [--from <agent>] [--to <agent>] [--label <label>]',
        'senderos sendero agent remove <sendero-id-or-slug> <agent-id-or-slug>',
      ],
      subcommands: [
        { command: 'add', summary: 'Add and connect an existing agent to a Sendero.', usage: ['senderos sendero agent add <sendero> <agent> [--from <agent>] [--to <agent>]'] },
        { command: 'remove', summary: 'Remove an agent and its connections from a Sendero.', usage: ['senderos sendero agent remove <sendero> <agent>'] },
      ],
    },
    {
      command: 'connect',
      summary: 'Connect two nodes in a Sendero.',
      usage: ['senderos sendero connect <sendero> --from <agent> --to <agent>'],
    },
    {
      command: 'disconnect',
      summary: 'Remove the connection between two Sendero nodes.',
      usage: ['senderos sendero disconnect <sendero> --from <node-or-agent> --to <node-or-agent>'],
    },
  ],
};

function option(options: Record<string, CliOptionValue>, name: string, required = false) {
  const value = options[name];
  if (typeof value === 'string') return value;
  if (required) throw new Error(`Missing required option: --${name}`);
  return undefined;
}

export async function handleSendero(
  subcommand: string | undefined,
  positionals: string[],
  options: Record<string, CliOptionValue>,
  home: string,
) {
  switch (subcommand) {
    case 'list':
      return listSenderos(home);
    case 'show': {
      const rawVersion = option(options, 'version');
      const version = rawVersion === undefined ? undefined : Number(rawVersion);
      if (version !== undefined && !Number.isInteger(version))
        throw new Error('Sendero version must be an integer');
      return getSenderoGraph(requirePositional(positionals[2], 'sendero id or slug'), version, home);
    }
    case 'version':
      if (positionals[2] !== 'list') throw new Error('Unknown sendero version action');
      return listSenderoVersions(home);
    case 'agent': {
      const action = positionals[2];
      const senderoId = requirePositional(positionals[3], 'sendero id or slug');
      const agentId = requirePositional(positionals[4], 'agent id or slug');
      if (action === 'add')
        return addAgentToSendero({ senderoId, agentId, from: option(options, 'from'), to: option(options, 'to'), label: option(options, 'label'), home });
      if (action === 'remove') return removeAgentFromSendero({ senderoId, agentId, home });
      throw new Error('Unknown sendero agent action');
    }
    case 'connect':
      return connectSenderoAgents({
        senderoId: requirePositional(positionals[2], 'sendero id or slug'),
        from: option(options, 'from', true)!,
        to: option(options, 'to', true)!,
        home,
      });
    case 'disconnect':
      return disconnectSenderoAgents({
        senderoId: requirePositional(positionals[2], 'sendero id or slug'),
        from: option(options, 'from', true)!,
        to: option(options, 'to', true)!,
        home,
      });
    default:
      throw new Error('Unknown sendero action');
  }
}
