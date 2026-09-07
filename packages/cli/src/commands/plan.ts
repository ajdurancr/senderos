import { plan } from '@senderos/core';
import { optionStrings } from '../shared';

export const planCommandHelp = {
  command: 'plan',
  summary: 'Plan the next dispatchable runs across Senderos.',
  agentDescription:
    'Call this first when you need actionable work. By default it returns only dispatchable goals. Use repeated --goal-status filters only when you intentionally want planning scoped to specific goal statuses.',
  usage: [
    'senderos plan',
    'senderos plan --goal-status active',
    'senderos plan --goal-status active --goal-status failed',
  ],
  options: [
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
  return await plan({
    home,
    goalStatuses: optionStrings(options['goal-status']) as any[],
  });
}
