import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import skillContent from '../skills/senderos/SKILL.md' with {
  type: 'text',
};

export const bootstrapAgentSkillCommandHelp = {
  command: 'bootstrap-agent-skill',
  summary:
    'Create or print portable guidance for operating Senderos.',
  agentDescription:
    'Use this to install configuration-agnostic Senderos operator guidance that relies on CLI help for current workflows and actions.',
  usage: [
    'senderos bootstrap-agent-skill',
    'senderos bootstrap-agent-skill --print',
    'senderos bootstrap-agent-skill --path ./.agents/skills/senderos/SKILL.md',
  ],
  options: [
    {
      name: '--print',
      description:
        'Print the generated skill content instead of writing it to disk.',
    },
    {
      name: '--path',
      description:
        'Where to write the skill scaffold. Defaults to ./.agents/skills/senderos/SKILL.md.',
    },
    { name: '--force', description: 'Overwrite an existing skill file.' },
  ],
};

const DEFAULT_SKILL_PATH = '.agents/skills/senderos/SKILL.md';

export async function handleBootstrapAgentSkill(
  options: Record<string, string | boolean | string[]>,
) {
  const requestedPath =
    (options.path as string | undefined) ?? DEFAULT_SKILL_PATH;
  const skillPath = resolve(requestedPath);
  const printOnly = Boolean(options.print);
  const force = Boolean(options.force);
  const exists = existsSync(skillPath);

  if (!printOnly) {
    if (exists && !force) {
      throw new Error(
        `Skill already exists at ${skillPath}. Re-run with --force to overwrite or --print to inspect the content.`,
      );
    }

    mkdirSync(dirname(skillPath), { recursive: true });
    writeFileSync(skillPath, skillContent);
  }

  return {
    mode: printOnly ? 'print' : 'write',
    skillPath,
    created: printOnly ? false : !exists,
    overwritten: printOnly ? false : exists,
    nextSteps: {
      guidance:
        'Use the Senderos CLI help to discover available workflows and actions.',
    },
    notes: [
      'This command installs guidance only; it does not configure or initialize Senderos.',
      'Use --print if you want a copy-pasteable skill instead of writing the scaffold to disk.',
    ],
    content: printOnly ? skillContent : undefined,
  };
}
