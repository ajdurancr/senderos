import {
  createProject,
  getProject,
  listProjects,
  updateProject,
} from '@senderos/core';
import { resolveExecutionContextId } from '@senderos/core';
import type { IntegrationMode } from '@senderos/core';
import { enumOption, optionString, requirePositional } from '../shared';
const integrationModes = ['github_pr', 'local_merge', 'none'] as const satisfies readonly IntegrationMode[];

const projectCreateHelp = {
  command: 'create',
  summary: 'Create a Senderos project.',
  agentDescription:
    'Register a workspace or project. GitHub and repository metadata are optional for non-software work.',
  usage: [
    'senderos project create --name Research [--canonical-path /workspace]',
    'senderos project create --canonical-path /repo --github-owner owner --github-repo repo [--id senderos-ab12cd34] [--name senderos] [--target-branch main] [--integration-mode github_pr]',
  ],
  options: [
    {
      name: '--canonical-path',
      description: 'Optional canonical workspace or repository path.',
    },
    {
      name: '--github-owner',
      description: 'Optional GitHub owner or organization; supply with --github-repo.',
    },
    {
      name: '--github-repo',
      description: 'Optional GitHub repository name; supply with --github-owner.',
    },
    { name: '--id', description: 'Optional explicit project id.' },
    { name: '--name', description: 'Optional project display name.' },
    {
      name: '--github-remote',
      description: 'Optional explicit GitHub remote URL.',
    },
    {
      name: '--target-branch',
      description: 'Canonical target branch. Defaults to main.',
    },
    {
      name: '--integration-mode',
      description: 'github_pr, local_merge, or none. Defaults to github_pr with GitHub metadata, otherwise none.',
    },
    {
      name: '--install-command',
      description: 'Inferred or overridden install command.',
    },
    {
      name: '--build-command',
      description: 'Inferred or overridden build command.',
    },
    {
      name: '--test-command',
      description: 'Inferred or overridden test command.',
    },
    {
      name: '--lint-command',
      description: 'Inferred or overridden lint command.',
    },
  ],
};

const projectListHelp = {
  command: 'list',
  summary: 'List Senderos projects.',
  agentDescription:
    'Use this to inspect all persisted project records in the current Senderos home.',
  usage: ['senderos project list'],
};

const projectShowHelp = {
  command: 'show',
  summary: 'Show a Senderos project.',
  agentDescription:
    'Use this to inspect one project record and its persisted repository details.',
  usage: ['senderos project show <project-id>'],
  arguments: [
    { name: 'project-id', description: 'Project identifier.', required: true },
  ],
};

const projectUpdateHelp = {
  command: 'update',
  summary: 'Update a Senderos project.',
  agentDescription:
    'Use this to mutate persisted project details when the repository, branch, or inferred commands need to change.',
  usage: [
    'senderos project update <project-id> [--name ...] [--target-branch ...] [--integration-mode ...]',
  ],
  arguments: [
    { name: 'project-id', description: 'Project identifier.', required: true },
  ],
};

export const projectCommandHelp = {
  command: 'project',
  summary: 'Create and manage Senderos projects.',
  agentDescription:
    'Use the project command to manage the workspace and repository records that Senderos attaches goals and runs to. This surface is for project state only.',
  usage: ['senderos project <create|list|show|update> ...'],
  subcommands: [
    projectCreateHelp,
    projectListHelp,
    projectShowHelp,
    projectUpdateHelp,
  ],
};

function commandMap(options: Record<string, string | boolean | string[]>) {
  const commands: Record<string, string> = {};
  for (const [name, option] of [
    ['install', 'install-command'],
    ['build', 'build-command'],
    ['test', 'test-command'],
    ['lint', 'lint-command'],
  ] as const) {
    const value = optionString(options[option]);
    if (value) commands[name] = value;
  }
  return commands;
}

function parseProjectCreateOptions(
  home: string,
  options: Record<string, string | boolean | string[]>,
) {
  return {
    home,
    id: optionString(options.id),
    name: optionString(options.name),
    canonicalPath: optionString(options['canonical-path']),
    githubOwner: optionString(options['github-owner']),
    githubRepo: optionString(options['github-repo']),
    githubRemote: optionString(options['github-remote']),
    targetBranch: optionString(options['target-branch']),
    integrationMode: enumOption(optionString(options['integration-mode']), integrationModes, 'integration-mode'),
    inferredCommands: commandMap(options),
  };
}

function parseProjectUpdateOptions(
  home: string,
  id: string,
  options: Record<string, string | boolean | string[]>,
) {
  const commands = commandMap(options);

  return {
    home,
    executionContextId: resolveExecutionContextId(home),
    id,
    name: optionString(options.name),
    canonicalPath: optionString(options['canonical-path']),
    githubOwner: optionString(options['github-owner']),
    githubRepo: optionString(options['github-repo']),
    githubRemote: optionString(options['github-remote']),
    targetBranch: optionString(options['target-branch']),
    integrationMode: enumOption(optionString(options['integration-mode']), integrationModes, 'integration-mode'),
    inferredCommands: Object.keys(commands).length ? commands : undefined,
  };
}

export async function handleProject(
  sub: string | undefined,
  positionals: string[],
  options: Record<string, string | boolean | string[]>,
  home: string,
) {
  const executionContextId = resolveExecutionContextId(home);
  switch (sub) {
    case 'create':
      return await createProject(parseProjectCreateOptions(home, options));
    case 'list':
      return await listProjects(home, executionContextId);
    case 'show':
      return await getProject(requirePositional(positionals[2], 'project id'), home, executionContextId);
    case 'update':
      return await updateProject(
        parseProjectUpdateOptions(
          home,
          requirePositional(positionals[2], 'project id'),
          options,
        ),
      );
    default:
      throw new Error('Unknown project action');
  }
}
