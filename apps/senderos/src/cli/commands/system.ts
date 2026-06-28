import { doctor, reconcile, schedulePlan, status } from '../../services/runtime';

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
