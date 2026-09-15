import {
  getSenderoGraph,
  listSenderos,
  listSenderoVersions,
  updateSenderoEdge,
  updateSenderoNode,
  type AgentTransitionStatus,
} from '@senderos/core';

import type { CliOptionValue } from '../args';
import { requirePositional } from '../shared';

const senderoNodeHelp = {
  command: 'node',
  summary: 'Manage nodes in a Sendero version.',
  usage: ['senderos sendero node update <node-id> [--label <label>]'],
  subcommands: [
    {
      command: 'update',
      summary: 'Update the business configuration of a Sendero node.',
      usage: ['senderos sendero node update <node-id> [--label <label>]'],
    },
  ],
};

const senderoEdgeHelp = {
  command: 'edge',
  summary: 'Manage edges in a Sendero version.',
  usage: [
    'senderos sendero edge update <edge-id> [--name <name>] [--description <description>] [--objective <objective>] [--status <status>]',
  ],
  subcommands: [
    {
      command: 'update',
      summary: 'Update the business configuration of a Sendero edge.',
      usage: [
        'senderos sendero edge update <edge-id> [--name <name>] [--description <description>] [--objective <objective>] [--status <status>]',
      ],
    },
  ],
};

export const senderoCommandHelp = {
  command: 'sendero',
  summary: 'Inspect and manage versioned Senderos.',
  agentDescription:
    'Use this command to inspect Sendero definitions and change node or edge business configuration. Canvas layout is intentionally managed by Mission Control, not this CLI.',
  usage: ['senderos sendero <list|show|versions|node|edge> ...'],
  subcommands: [
    {
      command: 'list',
      summary: 'List Senderos.',
      usage: ['senderos sendero list'],
    },
    {
      command: 'show',
      summary: 'Show one Sendero graph.',
      usage: ['senderos sendero show <sendero-id-or-slug> [--version <number>]'],
    },
    {
      command: 'versions',
      summary: 'List persisted Sendero versions.',
      usage: ['senderos sendero versions'],
    },
    senderoNodeHelp,
    senderoEdgeHelp,
  ],
};

function optionalString(value: CliOptionValue | undefined) {
  return typeof value === 'string' ? value : undefined;
}

export async function handleSendero(
  subcommand: string | undefined,
  positionals: string[],
  options: Record<string, CliOptionValue>,
  home: string,
) {
  switch (subcommand) {
    case 'list':
      return await listSenderos(home);
    case 'show': {
      const versionValue = optionalString(options.version);
      const version = versionValue === undefined ? undefined : Number(versionValue);
      if (version !== undefined && !Number.isInteger(version)) {
        throw new Error('Sendero version must be an integer');
      }
      return await getSenderoGraph(
        requirePositional(positionals[2], 'sendero id or slug'),
        version,
        home,
      );
    }
    case 'versions':
      return await listSenderoVersions(home);
    case 'node':
      if (positionals[2] !== 'update') throw new Error('Unknown sendero node action');
      return await updateSenderoNode({
        home,
        id: requirePositional(positionals[3], 'sendero node id'),
        label: optionalString(options.label),
      });
    case 'edge':
      if (positionals[2] !== 'update') throw new Error('Unknown sendero edge action');
      return await updateSenderoEdge({
        home,
        id: requirePositional(positionals[3], 'sendero edge id'),
        name: optionalString(options.name),
        description: optionalString(options.description),
        transitionObjective: optionalString(options.objective),
        status: optionalString(options.status) as AgentTransitionStatus | undefined,
      });
    default:
      throw new Error('Unknown sendero action');
  }
}
