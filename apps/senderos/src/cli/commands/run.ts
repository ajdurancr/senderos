import { getRun } from '../../services/runtime/run/dispatch';
import {
  cancelRun,
  dispatchRun,
  listRuns,
  showRunState,
} from '../../services/runtime';
import { optionString, requirePositional } from '../shared';
export const runCommandHelp = {
  command: 'run',
  summary: 'Dispatch, inspect, and cancel goal runs.',
  agentDescription:
    'Use planned goal and transition ids to create a concrete execution attempt.',
  usage: ['senderos run <dispatch|state|list|show|cancel> ...'],
  subcommands: [
    {
      command: 'dispatch',
      summary: 'Dispatch a planned goal.',
      agentDescription:
        'Dispatch exactly one planned goal through its selected transition.',
      usage: [
        'senderos run dispatch --goal-id <goal-id> --transition-id <transition-id> --agent-id <agent-id> [--previous-run-id <run-id>] [--working-path <path>]',
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
export function handleRun(
  sub: string | undefined,
  positionals: string[],
  options: Record<string, string | boolean | string[]>,
  home: string,
) {
  switch (sub) {
    case 'dispatch':
      return dispatchRun(
        {
          goalId: requirePositional(
            optionString(options['goal-id']),
            'goal id',
          ),
          transitionId: requirePositional(
            optionString(options['transition-id']),
            'transition id',
          ),
          agentId: requirePositional(
            optionString(options['agent-id']),
            'agent id',
          ),
          previousRunId: optionString(options['previous-run-id']),
          workingPath: optionString(options['working-path']),
        },
        home,
      );
    case 'state':
      return showRunState(
        requirePositional(
          optionString(options['goal-id']) ?? positionals[2],
          'goal id',
        ),
        home,
      );
    case 'list':
      return listRuns(home);
    case 'show':
      return getRun(requirePositional(positionals[2], 'run id'), home);
    case 'cancel':
      return cancelRun(requirePositional(positionals[2], 'run id'), home);
    default:
      throw new Error('Unknown run action');
  }
}
