import {
  activateGoal,
  cancelGoal,
  createGoal,
  getGoal,
  listGoals,
  updateGoal,
} from '@senderos/core';
import { requirePositional } from '../shared';
export const goalCommandHelp = {
  command: 'goal',
  summary: 'Create and manage Senderos goals.',
  usage: ['senderos goal <create|list|show|update|activate|cancel> ...'],
  subcommands: [
    {
      command: 'create',
      summary: 'Create a goal.',
      usage: ['senderos goal create --project-id <project-id> --title <title>'],
    },
    { command: 'list', summary: 'List goals.', usage: ['senderos goal list'] },
    {
      command: 'show',
      summary: 'Show a goal.',
      usage: ['senderos goal show <goal-id>'],
    },
    {
      command: 'update',
      summary: 'Update a goal.',
      usage: ['senderos goal update <goal-id>'],
    },
    {
      command: 'activate',
      summary: 'Activate a goal.',
      usage: ['senderos goal activate <goal-id>'],
    },
    {
      command: 'cancel',
      summary: 'Cancel a goal.',
      usage: ['senderos goal cancel <goal-id>'],
    },
  ],
};
export function handleGoal(
  subcommand: string | undefined,
  positionals: string[],
  options: Record<string, string | boolean | string[]>,
  home: string,
) {
  const goalId = () => requirePositional(positionals[2], 'goal id');
  const goalInput = {
    home,
    projectId: String(options['project-id'] ?? ''),
    title: String(options.title ?? ''),
    kind: options.kind as any,
    specText: options['spec-text'] as string | undefined,
    intakeText: options['intake-text'] as string | undefined,
  };
  switch (subcommand) {
    case 'create':
      return createGoal(goalInput);
    case 'list':
      return listGoals(home);
    case 'show':
      return getGoal(goalId(), home);
    case 'update':
      return updateGoal({ ...goalInput, id: goalId() });
    case 'activate':
      return activateGoal(goalId(), home);
    case 'cancel':
      return cancelGoal(goalId(), home);
    default:
      throw new Error('Unknown goal action');
  }
}
