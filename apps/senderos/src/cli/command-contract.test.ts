import { expect, test } from 'bun:test';

import { rootHelp } from './help';

const EXERCISED_ACTIONS = new Set([
  'init',
  'bootstrap-agent-skill',
  'config show', 'config get', 'config set',
  'project create', 'project list', 'project show', 'project update',
  'agent list', 'agent show',
  'transition create', 'transition list', 'transition show',
  'goal create', 'goal list', 'goal show', 'goal update', 'goal activate', 'goal cancel',
  'plan',
  'run dispatch', 'run state', 'run list', 'run show', 'run cancel',
  'attempt list', 'attempt show', 'attempt update', 'attempt resume',
  'doctor', 'status',
]);

test('every public CLI action has an exercised command-contract scenario', () => {
  const documentedActions = new Set(
    rootHelp.subcommands!.flatMap((command) =>
      command.subcommands?.length
        ? command.subcommands.map((action) => `${command.command} ${action.command}`)
        : [command.command],
    ),
  );

  expect([...EXERCISED_ACTIONS].sort()).toEqual([...documentedActions].sort());
});
