import {
  activateGoal,
  cancelGoal,
  createGoal,
  getGoal,
  listGoals,
  updateGoal,
} from '../../services/runtime';
import { requirePositional } from '../shared';
export const goalCommandHelp = {
  command: 'goal',
  summary: 'Create and manage Senderos goals.',
  usage: ['senderos goal <create|list|show|update|activate|cancel> ...'],
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
