import {
  activateGoal,
  cancelGoal,
  createGoal,
  getGoal,
  listGoals,
  updateGoal,
  explainGoal,
  setRetryBudget,
  setActivationBudget,
} from '@senderos/core';
import { resolveExecutionContextId } from '@senderos/core';
import { optionString, requirePositional } from '../shared';
export const goalCommandHelp = {
  command: 'goal',
  summary: 'Create and manage Senderos goals.',
  usage: ['senderos goal <create|list|show|update|activate|explain|retry-budget|activation-budget|cancel> ...'],
  subcommands: [
    { command: 'explain', summary: 'Explain lifecycle state, blockers and next action.', usage: ['senderos goal explain <goal-id>'] },
    { command: 'activation-budget', summary: 'Set the maximum graph activations for this goal.', usage: ['senderos goal activation-budget <goal-id> --max-activations <number>'] },
    { command: 'retry-budget', summary: 'Explicitly set the per-step attempt limit.', usage: ['senderos goal retry-budget <goal-id> --max-attempts <number>'] },
    {
      command: 'create',
      summary: 'Create a goal.',
      usage: ['senderos goal create --id <stable-id> --project-id <project-id> --title <title> [--kind <category>] [--sendero-version-id <published-version-id>]'],
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
    id: optionString(options.id),
    home,
    executionContextId,
    projectId: String(options['project-id'] ?? ''),
    title: String(options.title ?? ''),
    kind: optionString(options.kind),
    specText: optionString(options['spec-text']),
    intakeText: optionString(options['intake-text']),
    senderoVersionId: optionString(options['sendero-version-id']),
  };
  switch (subcommand) {
    case 'explain': return explainGoal(await requireOwnedGoal(), home);
    case 'activation-budget': return setActivationBudget(await requireOwnedGoal(), Number(options['max-activations']), home);
    case 'retry-budget': return setRetryBudget(await requireOwnedGoal(), Number(options['max-attempts']), home);
    case 'create':
      return await createGoal(goalInput);
    case 'list':
      return await listGoals(home, executionContextId);
    case 'show':
      return await getGoal(goalId(), home, executionContextId);
    case 'update':
      return await updateGoal({ ...goalInput, title: optionString(options.title), id: await requireOwnedGoal() });
    case 'activate':
      return await activateGoal(await requireOwnedGoal(), home);
    case 'cancel':
      return await cancelGoal(await requireOwnedGoal(), home);
    default:
      throw new Error('Unknown goal action');
  }
}
