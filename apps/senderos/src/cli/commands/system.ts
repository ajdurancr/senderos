import { doctor, orchestrateSupervisions, reconcile, schedulePlan, status } from '../../services/runtime';

const doctorHelp = {
  command: 'doctor',
  summary: 'Validate Senderos runtime health.',
  usage: ['senderos doctor'],
};

const statusHelp = {
  command: 'status',
  summary: 'Show current system status.',
  usage: ['senderos status'],
};

const reconcileHelp = {
  command: 'reconcile',
  summary: 'Repair stale runtime state.',
  usage: ['senderos reconcile'],
};

const superviseActiveHelp = {
  command: 'supervise-active',
  summary: 'Scan active features and dispatch or advance ephemeral sendero supervision.',
  usage: ['senderos supervise-active'],
};

const schedulePlanHelp = {
  command: 'schedule-plan',
  summary: 'Emit host scheduling instructions.',
  usage: ['senderos schedule-plan'],
};

export const systemCommandsHelp = [doctorHelp, statusHelp, reconcileHelp, superviseActiveHelp, schedulePlanHelp];

export function handleSystemCommand(cmd: string | undefined, home: string) {
  switch (cmd) {
    case 'doctor':
      return doctor(home);
    case 'status':
      return status(home);
    case 'reconcile':
      return reconcile(home);
    case 'supervise-active':
      return orchestrateSupervisions(home);
    case 'schedule-plan':
      return schedulePlan(home);
    default:
      throw new Error(`Unknown command: ${cmd}`);
  }
}
