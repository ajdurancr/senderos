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
  sub: string | undefined,
  p: string[],
  o: Record<string, string | boolean | string[]>,
  home: string,
) {
  const id = () => requirePositional(p[2], 'goal id');
  const data = {
    home,
    projectId: String(o['project-id'] ?? ''),
    title: String(o.title ?? ''),
    kind: o.kind as any,
    specText: o['spec-text'] as string | undefined,
    intakeText: o['intake-text'] as string | undefined,
  };
  switch (sub) {
    case 'create':
      return createGoal(data);
    case 'list':
      return listGoals(home);
    case 'show':
      return getGoal(id(), home);
    case 'update':
      return updateGoal({ ...data, id: id() });
    case 'activate':
      return activateGoal(id(), home);
    case 'cancel':
      return cancelGoal(id(), home);
    default:
      throw new Error('Unknown goal action');
  }
}
