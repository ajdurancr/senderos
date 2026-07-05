import { plan } from '../../services/runtime';
import { optionStrings } from '../shared';

export const planCommandHelp = {
  command: 'plan',
  summary: 'Plan the next dispatchable runs across Senderos.',
  agentDescription:
    'Call this first when you need actionable work. By default it returns only dispatchable items. Use repeated --feature-status filters only when you intentionally want planning scoped to specific feature statuses.',
  usage: [
    'senderos plan',
    'senderos plan --feature-status active',
    'senderos plan --feature-status active --feature-status failed',
  ],
  options: [
    { name: '--feature-status', description: 'Repeatable feature status filter used to scope planning input.' },
  ],
};

export function handlePlan(options: Record<string, string | boolean | string[]>, home: string) {
  return plan({ home, featureStatuses: optionStrings(options['feature-status']) as any[] });
}
