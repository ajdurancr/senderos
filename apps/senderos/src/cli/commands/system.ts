import { doctor, status } from '../../services/runtime';

const doctorHelp = {
  command: 'doctor',
  summary: 'Validate SenderOS runtime health.',
  agentDescription:
    'Use this when you need a strict health validation of the configured SenderOS home and database wiring before relying on runtime output.',
  usage: ['senderos doctor'],
};

const statusHelp = {
  command: 'status',
  summary: 'Show current SenderOS runtime status.',
  agentDescription:
    'Use this for diagnostic visibility only. It reports aggregate counts plus stale sessions and orphaned workspaces, but it does not mutate state or create dispatches.',
  usage: ['senderos status'],
};

export const systemCommandsHelp = [doctorHelp, statusHelp];

export function handleSystemCommand(cmd: string | undefined, home: string) {
  switch (cmd) {
    case 'doctor':
      return doctor(home);
    case 'status':
      return status(home);
    default:
      throw new Error(`Unknown command: ${cmd}`);
  }
}
