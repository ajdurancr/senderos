import {
  getAttempt,
  listRunAttempts,
  resumeAttempt,
  updateRunAttempt,
} from '@senderos/core';
import { resolveExecutionContextId } from '@senderos/core';
import { enumOption, optionString, requirePositional } from '../shared';
import type { RunAttemptStatus } from '@senderos/core';
const attemptStatuses = ['queued', 'running', 'paused', 'succeeded', 'failed', 'canceled'] as const satisfies readonly RunAttemptStatus[];
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
export async function handleAttempt(
  subcommand: string | undefined,
  positionals: string[],
  options: Record<string, string | boolean | string[]>,
  home: string,
) {
  const executionContextId = resolveExecutionContextId(home);
  const requireOwnedAttempt = async () => {
    const id = requirePositional(positionals[2], 'attempt id');
    if (!(await getAttempt(id, home, executionContextId)))
      throw new Error(`Attempt not found in the current execution context: ${id}`);
    return id;
  };
  switch (subcommand) {
    case 'list':
      return await listRunAttempts(optionString(options['run-id']), home, executionContextId);
    case 'show':
      return await getAttempt(requirePositional(positionals[2], 'attempt id'), home, executionContextId);
    case 'update':
      return await updateRunAttempt(
        await requireOwnedAttempt(),
        {
          status: enumOption(optionString(options.status), attemptStatuses, 'status'),
          checkpoint: optionString(options.checkpoint),
          workingPath: optionString(options['working-path']),
          externalSessionId: optionString(options['external-session-id']),
          resumeCommand: optionString(options['resume-command']),
          failureStep: optionString(options['failure-step']),
          failureSummary: optionString(options['failure-summary']),
          result: options['result-json']
            ? JSON.parse(String(options['result-json']))
            : undefined,
        },
        home,
      );
    case 'resume':
      return await resumeAttempt(
        await requireOwnedAttempt(),
        home,
      );
    default:
      throw new Error('Unknown attempt action');
  }
}
