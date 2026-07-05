import { getRun } from '../../services/run-state';
import { cancelRun, dispatchRun, listRuns, showRunState } from '../../services/runtime';
import { optionString, requirePositional } from '../shared';

const runDispatchHelp = {
  command: 'dispatch',
  summary: 'Create the next concrete run dispatch from a planning item.',
  agentDescription:
    'Call this only after `senderos plan` returns a dispatchable item. Pass through the ids that plan returned so Senderos can atomically create the new run, session, and run execution records for that dispatch.',
  usage: [
    'senderos run dispatch --feature-id <feature-id> --sendero-id <sendero-id> --agent-id <agent-id> [--previous-run-id <run-id>]',
  ],
  options: [
    { name: '--feature-id', description: 'Feature identifier from senderos plan.', required: true },
    { name: '--sendero-id', description: 'Sendero identifier from senderos plan.', required: true },
    { name: '--agent-id', description: 'Agent identifier from senderos plan.', required: true },
    { name: '--previous-run-id', description: 'Previous run id from senderos plan when dispatching after an earlier run.' },
  ],
};

const runStateHelp = {
  command: 'state',
  summary: 'Show current run state for a feature.',
  agentDescription:
    'Use this for detailed state inspection on a specific feature after planning or dispatch. It returns the current run, current run execution, and workspace/session-linked state for that feature.',
  usage: ['senderos run state <feature-id>', 'senderos run state --feature-id <feature-id>'],
};

const runListHelp = {
  command: 'list',
  summary: 'List Senderos runs.',
  agentDescription:
    'Use this when you need a raw list of all persisted runs for debugging or audits. It is not the planning surface.',
  usage: ['senderos run list'],
};

const runShowHelp = {
  command: 'show',
  summary: 'Show a persisted Senderos run record.',
  agentDescription:
    'Use this to inspect one logical run record by id. This is useful when you already know the run id from dispatch output or stored state.',
  usage: ['senderos run show <run-id>'],
  arguments: [{ name: 'run-id', description: 'Run identifier.', required: true }],
};

const runCancelHelp = {
  command: 'cancel',
  summary: 'Cancel a Senderos run.',
  agentDescription:
    'Use this to stop a logical run and cascade cancellation into the linked feature state. This is a mutation and should only be used when you intentionally want to halt progress.',
  usage: ['senderos run cancel <run-id>'],
  arguments: [{ name: 'run-id', description: 'Run identifier.', required: true }],
};

export const runCommandHelp = {
  command: 'run',
  summary: 'Dispatch, inspect, and cancel Senderos runs.',
  agentDescription:
    'The run command is the mutation and inspection surface for logical runs. Use `dispatch` with ids returned by `senderos plan`; use `state`, `list`, and `show` for inspection; use `cancel` to halt work intentionally.',
  usage: ['senderos run <dispatch|state|list|show|cancel> ...'],
  subcommands: [runDispatchHelp, runStateHelp, runListHelp, runShowHelp, runCancelHelp],
};

function featureIdForRun(positionals: string[], options: Record<string, string | boolean | string[]>) {
  return String(optionString(options['feature-id']) ?? positionals[2] ?? '');
}

export function handleRun(
  sub: string | undefined,
  positionals: string[],
  options: Record<string, string | boolean | string[]>,
  home: string
) {
  switch (sub) {
    case 'dispatch':
      return dispatchRun(
        {
          featureId: requirePositional(optionString(options['feature-id']), 'feature id'),
          senderoId: requirePositional(optionString(options['sendero-id']), 'sendero id'),
          agentId: requirePositional(optionString(options['agent-id']), 'agent id'),
          previousRunId: optionString(options['previous-run-id']),
        },
        home
      );
    case 'state':
      return showRunState(requirePositional(featureIdForRun(positionals, options), 'feature id'), home);
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
