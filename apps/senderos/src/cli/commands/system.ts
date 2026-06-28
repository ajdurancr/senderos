import { doctor, reconcile, schedulePlan, status } from '../../services/runtime';

export const systemCommandsHelp = [
  { command: 'doctor', summary: 'Validate Senderos runtime health.', usage: ['senderos doctor'] },
  { command: 'status', summary: 'Show current system status.', usage: ['senderos status'] },
  { command: 'reconcile', summary: 'Repair stale runtime state.', usage: ['senderos reconcile'] },
  {
    command: 'schedule-plan',
    summary: 'Emit host scheduling instructions.',
    usage: ['senderos schedule-plan'],
  },
];

export function handleSystemCommand(cmd: string | undefined, home: string) {
  switch (cmd) {
    case 'doctor':
      return doctor(home);
    case 'status':
      return status(home);
    case 'reconcile':
      return reconcile(home);
    case 'schedule-plan':
      return schedulePlan(home);
    default:
      throw new Error(`Unknown command: ${cmd}`);
  }
}
