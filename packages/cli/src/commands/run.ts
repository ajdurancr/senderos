import { getGoal, getRun } from '@senderos/core';
import {
  cancelRun,
  dispatchRun,
  listRuns,
  showRunState,
} from '@senderos/core';
import { resolveExecutionContextId } from '@senderos/core';
import { optionString, requirePositional } from '../shared';
export const runCommandHelp = {
  command: 'run',
  summary: 'Dispatch, inspect, and cancel goal runs.',
  agentDescription:
    'Use Core planning decisions to reserve one concrete attempt. Dispatch does not start an external session; claim the returned attempt next.',
  usage: ['senderos run <dispatch|state|list|show|cancel> ...'],
  subcommands: [
    {
      command: 'dispatch',
      summary: 'Dispatch a planned goal.',
      agentDescription:
        'Reserve exactly one planned step with a stable request id, then claim the returned attempt.',
      usage: [
        'senderos run dispatch --goal-id <goal-id> --request-id <stable-id> [--activation-id <activation-id>] [--expected-revision <revision>] [--transition-id <transition-id>] [--agent-id <agent-id>] [--working-path <path>]',
      ],
    },
    {
      command: 'state',
      summary: 'Show run state for a goal.',
      usage: ['senderos run state <goal-id>'],
    },
    { command: 'list', summary: 'List runs.', usage: ['senderos run list'] },
    {
      command: 'show',
      summary: 'Show a run.',
      usage: ['senderos run show <run-id>'],
    },
    {
      command: 'cancel',
      summary: 'Cancel a run.',
      usage: ['senderos run cancel <run-id>'],
    },
  ],
};
export async function handleRun(
  sub: string | undefined,
  positionals: string[],
  options: Record<string, string | boolean | string[]>,
  home: string,
) {
  const executionContextId = resolveExecutionContextId(home);
  const requireOwnedRun = async (id: string) => {
    if (!(await getRun(id, home, executionContextId)))
      throw new Error(`Run not found in the current execution context: ${id}`);
    return id;
  };
  switch (sub) {
    case 'dispatch':
      if (!(await getGoal(
        requirePositional(optionString(options['goal-id']), 'goal id'),
        home,
        executionContextId,
      ))) throw new Error('Goal not found in the current execution context.');
      return await dispatchRun(
        {
          goalId: requirePositional(
            optionString(options['goal-id']),
            'goal id',
          ),
          activationId: optionString(options['activation-id']),
          transitionId: optionString(options['transition-id']),
          agentId: optionString(options['agent-id']),
          requestId: optionString(options['request-id']),
          expectedRevision: options['expected-revision'] === undefined ? undefined : Number(options['expected-revision']),
          previousRunId: optionString(options['previous-run-id']),
          workingPath: optionString(options['working-path']),
        },
        home,
      );
    case 'state':
      {
        const id = requirePositional(
          optionString(options['goal-id']) ?? positionals[2],
          'goal id',
        );
        if (!(await getGoal(id, home, executionContextId)))
          throw new Error(`Goal not found in the current execution context: ${id}`);
        return await showRunState(id, home);
      }
    case 'list':
      return await listRuns(home, executionContextId);
    case 'show':
      return await getRun(requirePositional(positionals[2], 'run id'), home, executionContextId);
    case 'cancel':
      return await cancelRun(await requireOwnedRun(requirePositional(positionals[2], 'run id')), home);
    default:
      throw new Error('Unknown run action');
  }
}
