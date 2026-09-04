import {
  getAttempt,
  listRunAttempts,
  resumeAttempt,
  updateRunAttempt,
} from '@senderos/core';
import { requirePositional } from '../shared';
export const attemptCommandHelp = {
  command: 'attempt',
  summary: 'Inspect concrete run attempts.',
  usage: ['senderos attempt <list|show|update|resume> ...'],
  subcommands: [
    {
      command: 'list',
      summary: 'List run attempts.',
      usage: ['senderos attempt list [--run-id <run-id>]'],
    },
    {
      command: 'show',
      summary: 'Show a run attempt.',
      usage: ['senderos attempt show <attempt-id>'],
    },
    {
      command: 'update',
      summary: 'Record attempt state and outcome.',
      usage: ['senderos attempt update <attempt-id> --status <status>'],
    },
    {
      command: 'resume',
      summary: 'Show attempt resume information.',
      usage: ['senderos attempt resume <attempt-id>'],
    },
  ],
};
export function handleAttempt(
  subcommand: string | undefined,
  positionals: string[],
  options: Record<string, string | boolean | string[]>,
  home: string,
) {
  switch (subcommand) {
    case 'list':
      return listRunAttempts(options['run-id'] as string | undefined, home);
    case 'show':
      return getAttempt(requirePositional(positionals[2], 'attempt id'), home);
    case 'update':
      return updateRunAttempt(
        requirePositional(positionals[2], 'attempt id'),
        {
          status: options.status as any,
          checkpoint: options.checkpoint as string | undefined,
          workingPath: options['working-path'] as string | undefined,
          externalSessionId: options['external-session-id'] as
            | string
            | undefined,
          resumeCommand: options['resume-command'] as string | undefined,
          failureStep: options['failure-step'] as string | undefined,
          failureSummary: options['failure-summary'] as string | undefined,
          result: options['result-json']
            ? JSON.parse(String(options['result-json']))
            : undefined,
        },
        home,
      );
    case 'resume':
      return resumeAttempt(
        requirePositional(positionals[2], 'attempt id'),
        home,
      );
    default:
      throw new Error('Unknown attempt action');
  }
}
