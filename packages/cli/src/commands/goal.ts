import {
  activateGoal,
  cancelGoal,
  createGoal,
  getGoal,
  listGoals,
  updateGoal,
} from '@senderos/core';
import { resolveExecutionContextId } from '@senderos/core';
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
export async function handleGoal(
  subcommand: string | undefined,
  positionals: string[],
  options: Record<string, string | boolean | string[]>,
  home: string,
) {
  const executionContextId = resolveExecutionContextId(home);
  const goalId = () => requirePositional(positionals[2], 'goal id');
  const requireOwnedGoal = async () => {
    const id = goalId();
    if (!(await getGoal(id, home, executionContextId)))
      throw new Error(`Goal not found in the current execution context: ${id}`);
    return id;
  };
  const goalInput = {
    home,
    executionContextId,
    projectId: String(options['project-id'] ?? ''),
    title: String(options.title ?? ''),
    kind: options.kind as any,
    specText: options['spec-text'] as string | undefined,
    intakeText: options['intake-text'] as string | undefined,
  };
  switch (subcommand) {
    case 'create':
      return await createGoal(goalInput);
    case 'list':
      return await listGoals(home, executionContextId);
    case 'show':
      return await getGoal(goalId(), home, executionContextId);
    case 'update':
      return await updateGoal({ ...goalInput, id: await requireOwnedGoal() });
    case 'activate':
      return await activateGoal(await requireOwnedGoal(), home);
    case 'cancel':
      return await cancelGoal(await requireOwnedGoal(), home);
    default:
      throw new Error('Unknown goal action');
  }
}
