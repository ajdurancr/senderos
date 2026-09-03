import {
  createProject,
  getProject,
  listProjects,
  updateProject,
} from '@senderos/senderos';
import { requirePositional } from '../shared';

const projectCreateHelp = {
  command: 'create',
  summary: 'Create a Senderos project.',
  agentDescription:
    'Use this to register a repository as a Senderos-managed project. It persists canonical repo identity and setup details that later goals and runs depend on.',
  usage: [
    'senderos project create --canonical-path /repo --github-owner owner --github-repo repo [--id senderos-ab12cd34] [--name senderos] [--target-branch main] [--integration-mode github_pr]',
  ],
  options: [
    {
      name: '--canonical-path',
      description: 'Canonical local repository path.',
      required: true,
    },
    {
      name: '--github-owner',
      description: 'GitHub owner or organization.',
      required: true,
    },
    {
      name: '--github-repo',
      description: 'GitHub repository name.',
      required: true,
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
      description: 'Integration mode. Defaults to github_pr.',
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
    'Use the project command to manage the repository records that Senderos attaches goals and runs to. This surface is for project state only.',
  usage: ['senderos project <create|list|show|update> ...'],
  subcommands: [
    projectCreateHelp,
    projectListHelp,
    projectShowHelp,
    projectUpdateHelp,
  ],
};

function commandMap(options: Record<string, string | boolean | string[]>) {
  return {
    install: options['install-command'],
    build: options['build-command'],
    test: options['test-command'],
    lint: options['lint-command'],
  };
}

function parseProjectCreateOptions(
  home: string,
  options: Record<string, string | boolean | string[]>,
) {
  return {
    home,
    id: options.id as string | undefined,
    name: options.name as string | undefined,
    canonicalPath: String(options['canonical-path'] ?? ''),
    githubOwner: String(options['github-owner'] ?? ''),
    githubRepo: String(options['github-repo'] ?? ''),
    githubRemote: options['github-remote'] as string | undefined,
    targetBranch: options['target-branch'] as string | undefined,
    integrationMode: options['integration-mode'] as any,
    inferredCommands: Object.fromEntries(
      Object.entries(commandMap(options)).filter(
        ([, value]) => typeof value === 'string' && value,
      ),
    ),
  };
}

function parseProjectUpdateOptions(
  home: string,
  id: string,
  options: Record<string, string | boolean | string[]>,
) {
  const commands = Object.fromEntries(
    Object.entries(commandMap(options)).filter(
      ([, value]) => typeof value === 'string' && value,
    ),
  );

  return {
    home,
    id,
    name: options.name as string | undefined,
    canonicalPath: options['canonical-path'] as string | undefined,
    githubOwner: options['github-owner'] as string | undefined,
    githubRepo: options['github-repo'] as string | undefined,
    githubRemote: options['github-remote'] as string | undefined,
    targetBranch: options['target-branch'] as string | undefined,
    integrationMode: options['integration-mode'] as any,
    inferredCommands: Object.keys(commands).length ? commands : undefined,
  };
}

export function handleProject(
  sub: string | undefined,
  positionals: string[],
  options: Record<string, string | boolean | string[]>,
  home: string,
) {
  switch (sub) {
    case 'create':
      return createProject(parseProjectCreateOptions(home, options));
    case 'list':
      return listProjects(home);
    case 'show':
      return getProject(requirePositional(positionals[2], 'project id'), home);
    case 'update':
      return updateProject(
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
