import { plan } from '@senderos/core';
import { listGoals, explainGoal } from '@senderos/core';
import { resolveExecutionContextId } from '@senderos/core';
import type { GoalStatus } from '@senderos/core';
import { enumOption, optionStrings } from '../shared';
const goalStatuses = ['draft', 'active', 'failed', 'blocked', 'canceled', 'completed'] as const satisfies readonly GoalStatus[];

export const planCommandHelp = {
  command: 'plan',
  summary: 'Plan the next dispatchable runs across Senderos.',
  agentDescription:
    'Call this first when you need actionable work. By default it returns only dispatchable goals. Use repeated --goal-status filters only when you intentionally want planning scoped to specific goal statuses.',
  usage: [
    'senderos plan',
    'senderos plan --explain',
    'senderos plan --goal-status active',
    'senderos plan --goal-status active --goal-status failed',
  ],
  options: [
    {
      name: '--explain',
      description: 'Return every goal lifecycle decision, including blockers and next actions.',
    },
    {
      name: '--goal-status',
      description:
        'Repeatable goal status filter used to scope planning input.',
    },
  ],
};

export async function handlePlan(
  options: Record<string, string | boolean | string[]>,
  home: string,
) {
  if (options.explain === true) {
    const goals = await listGoals(home, resolveExecutionContextId(home));
    const decisions = [];
    for (const goal of goals) decisions.push(await explainGoal(goal.id, home));
    return decisions;
  }
  return await plan({
    home,
    executionContextId: resolveExecutionContextId(home),
    goalStatuses: optionStrings(options['goal-status']).map((status) =>
      enumOption(status, goalStatuses, 'goal-status')!,
    ),
  });
}
