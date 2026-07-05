import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export const bootstrapAgentSkillCommandHelp = {
  command: 'bootstrap-agent-skill',
  summary: 'Create or print a host-agent skill scaffold for operating SenderOS.',
  agentDescription:
    'Use this to bootstrap a SenderOS operator skill scaffold. It helps initialize a stable operating agent before routing work through the SenderOS CLI.',
  usage: [
    'senderos bootstrap-agent-skill',
    'senderos bootstrap-agent-skill --print',
    'senderos bootstrap-agent-skill --path ./skills/senderos-operator/SKILL.md',
    'senderos bootstrap-agent-skill --path ./skills/senderos-operator/SKILL.md --home /path/to/.senderos --harness codex',
  ],
  options: [
    { name: '--print', description: 'Print the generated skill content instead of writing it to disk.' },
    { name: '--path', description: 'Where to write the skill scaffold. Defaults to ./skills/senderos-operator/SKILL.md.' },
    { name: '--force', description: 'Overwrite an existing skill file.' },
    { name: '--home', description: 'Preferred SenderOS home to reference in next-step commands.' },
    { name: '--harness', description: 'Preferred harness to reference in next-step commands.' },
  ],
};

const DEFAULT_SKILL_PATH = 'skills/senderos-operator/SKILL.md';

function buildInitCommand(home?: string, harness?: string) {
  const parts = ['senderos', 'init'];
  if (home) parts.push('--home', home);
  if (harness) parts.push('--harness', harness);
  parts.push('--approve');
  return parts.join(' ');
}

function buildSkillContent(initCommand: string) {
  return `---
name: senderos_operator
description: Operate SenderOS as the primary orchestration interface for a human. Help refine ideas into features, drive SenderOS CLI commands, explain status, and guide onboarding when the runtime is not initialized yet.
---

# SenderOS Operator

You are the operating agent for SenderOS.

Your job is to help the human discuss ideas, translate those ideas into SenderOS projects/features/tasks, and operate SenderOS through the CLI.

## Default posture

- Prefer driving SenderOS through the CLI instead of asking the human to memorize commands.
- Be conversational when refining ideas, but write concrete SenderOS state when decisions are ready.
- If SenderOS is not initialized yet, guide onboarding first.
- The human may also run the CLI directly; support both modes cleanly.

## Onboarding

When the runtime is not initialized yet, recommend or run:

\`\`\`bash
${initCommand}
\`\`\`

After initialization, help the human:

1. register the current repo as a SenderOS project
2. turn discussed ideas into SenderOS features
3. guide approval flow and loop kickoff
4. monitor status, sessions, runs, and cleanup as work progresses

## Ongoing responsibilities

- refine vague ideas into concrete feature proposals
- explain what SenderOS commands will do before running them when useful
- use SenderOS CLI capabilities to inspect status and manage work
- keep the human oriented: what exists, what is active, what is blocked, what needs approval

## Style

- Human-friendly first, machine-precise second.
- Prefer exact commands and short explanations.
- If the human wants direct CLI usage, provide copy-pasteable commands.
- If the human wants agent-driven operation, do the work through SenderOS and summarize the result.
`;
}

export async function handleBootstrapAgentSkill(
  options: Record<string, string | boolean | string[]>
) {
  const preferredHome = options.home as string | undefined;
  const preferredHarness = options.harness as string | undefined;
  const requestedPath = (options.path as string | undefined) ?? DEFAULT_SKILL_PATH;
  const skillPath = resolve(requestedPath);
  const initCommand = buildInitCommand(preferredHome, preferredHarness);
  const content = buildSkillContent(initCommand);
  const printOnly = Boolean(options.print);
  const force = Boolean(options.force);
  const exists = existsSync(skillPath);

  if (!printOnly) {
    if (exists && !force) {
      throw new Error(`Skill already exists at ${skillPath}. Re-run with --force to overwrite or --print to inspect the content.`);
    }

    mkdirSync(dirname(skillPath), { recursive: true });
    writeFileSync(skillPath, content);
  }

  return {
    mode: printOnly ? 'print' : 'write',
    skillPath,
    created: printOnly ? false : !exists,
    overwritten: printOnly ? false : exists,
    directCli: {
      initCommand,
      previewCommand: initCommand.replace(/ --approve$/, ''),
    },
    nextSteps: {
      agentPrompt:
        'Use the SenderOS Operator skill to onboard this repo, initialize SenderOS if needed, and then help me create the first project/feature.',
      cliFallback:
        'If you prefer direct CLI usage, run the preview command first, then rerun the init command with --approve.',
    },
    notes: [
      'This command prepares the agent operating layer; it does not initialize SenderOS by itself.',
      'Use --print if you want a copy-pasteable skill instead of writing the scaffold to disk.',
    ],
    content: printOnly ? content : undefined,
  };
}
