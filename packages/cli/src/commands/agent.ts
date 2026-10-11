import { readFileSync } from 'node:fs';
import { createAgent, getAgent, getAgentBySlug, listAgents, updateAgent, upsertAgent } from '@senderos/core';
import type { AgentDefinitionInput } from '@senderos/core';
import type { CliOptionValue } from '../args';
import { enumOption, optionString, requirePositional } from '../shared';

export const agentCommandHelp = {
  command: 'agent',
  summary: 'Create, edit, import, and inspect Senderos agent definitions.',
  agentDescription: 'Agent definitions contain instructions. Hosts remain responsible for executing them. Published Sendero versions retain pinned instructions.',
  usage: ['senderos agent <list|show|create|update|import> ...'],
  subcommands: [
    { command: 'list', summary: 'List Senderos agents.', usage: ['senderos agent list'] },
    { command: 'show', summary: 'Show an agent by ID or slug.', usage: ['senderos agent show <agent>'] },
    { command: 'create', summary: 'Create a custom agent.', usage: ['senderos agent create --slug researcher --name Researcher --instructions "Research the objective."', 'senderos agent create --slug researcher --name Researcher --instructions-file agent.md'], options: [
      { name: '--slug', description: 'Unique lowercase identifier.', required: true },
      { name: '--name', description: 'Display name.', required: true },
      { name: '--instructions', description: 'Agent instructions; alternatively use --instructions-file.' },
      { name: '--instructions-file', description: 'UTF-8 instructions file.' },
      { name: '--description', description: 'Agent description.' },
      { name: '--default-goal', description: 'Default execution objective.' },
      { name: '--status', description: 'active, disabled, or archived.' },
    ] },
    { command: 'update', summary: 'Edit an agent definition.', usage: ['senderos agent update <agent> [--name ...] [--instructions-file agent.md] [--status disabled]'] },
    { command: 'import', summary: 'Create or update an agent from a JSON definition.', usage: ['senderos agent import --file agent.json'] },
  ],
};

export async function handleAgent(
  sub: string | undefined,
  positionals: string[],
  home: string,
  options: Record<string, CliOptionValue> = {},
) {
  const definition = () => {
    const instructionsFile = optionString(options['instructions-file']);
    const instructions = optionString(options.instructions);
    if (instructionsFile && instructions !== undefined) throw new Error('Use --instructions or --instructions-file, not both');
    return {
      home, slug: optionString(options.slug), name: optionString(options.name),
      description: optionString(options.description),
      instructions: instructionsFile ? readFileSync(instructionsFile, 'utf8') : instructions,
      defaultGoal: optionString(options['default-goal']),
      status: enumOption(optionString(options.status), ['active', 'disabled', 'archived'] as const, 'status'),
    };
  };
  switch (sub) {
    case 'list': return listAgents(home);
    case 'show': {
      const reference = requirePositional(positionals[2], 'agent id or slug');
      return (await getAgent(reference, home)) ?? getAgentBySlug(reference, home);
    }
    case 'create': {
      const input = definition();
      return createAgent({ ...input, slug: requirePositional(input.slug, '--slug'), name: requirePositional(input.name, '--name') });
    }
    case 'update': return updateAgent({ ...definition(), id: requirePositional(positionals[2], 'agent id or slug') });
    case 'import': {
      const input = JSON.parse(readFileSync(requirePositional(optionString(options.file), '--file'), 'utf8'));
      if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Agent definition must be a JSON object');
      return upsertAgent({ ...input as AgentDefinitionInput, home });
    }
    default: throw new Error('Unknown agent action');
  }
}
