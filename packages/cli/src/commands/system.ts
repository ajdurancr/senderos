import { doctor, status } from '@senderos/core';

const doctorHelp = {
  command: 'doctor',
  summary: 'Validate Senderos runtime health.',
  agentDescription:
    'Use this when you need a strict health validation of the configured Senderos home and database wiring before relying on runtime output.',
  usage: ['senderos doctor'],
};

const statusHelp = {
  command: 'status',
  summary: 'Show current Senderos runtime status.',
  agentDescription:
    'Use this for diagnostic visibility only. It reports aggregate project, goal, run, and attempt state without mutating anything.',
  usage: ['senderos status'],
};

export const systemCommandsHelp = [doctorHelp, statusHelp];

export async function handleSystemCommand(cmd: string | undefined, home: string) {
  switch (cmd) {
    case 'doctor':
      return await doctor(home);
    case 'status':
      return await status(home);
    default:
      throw new Error(`Unknown command: ${cmd}`);
  }
}
