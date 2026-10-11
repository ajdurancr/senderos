import { declareHostWorkspace, discoverHostAttempts, grantHostWorkspace, listHosts, loadConfig, registerExecutionContext, registerHost, resolveExecutionContextId } from '@senderos/core';
import { optionString, optionStrings, requirePositional } from '../shared';

export const hostCommandHelp = {
  command: 'host',
  summary: 'Register execution capabilities and explicit workspace access; hosts execute all work externally.',
  usage: ['senderos host <context-register|register|list|grant|workspace|discover> ...'],
  subcommands: [
    { command: 'context-register', summary: 'Register this runtime context after selecting a shared database.', usage: ['senderos host context-register --name <context-name>'] },
    { command: 'register', summary: 'Declare a tool and machine identity in this context.', usage: ['senderos host register <id> --name <name> --capability independent_session [--capability <capability>] [--harness <tool>] [--disabled]'] },
    { command: 'list', summary: 'List hosts in this context.', usage: ['senderos host list'] },
    { command: 'grant', summary: 'Grant or revoke access from the project-owning context.', usage: ['senderos host grant <id> --project-id <id> --workspace-ref <portable-reference> [--revoke]'] },
    { command: 'workspace', summary: 'Declare host-local availability; Core never inspects or synchronizes files.', usage: ['senderos host workspace <id> --project-id <id> --available --working-path <path>', 'senderos host workspace <id> --project-id <id> --unavailable'] },
    { command: 'discover', summary: 'List granted unfinished assignments and capability/workspace blockers.', usage: ['senderos host discover <id>'] },
  ],
};
export async function handleHost(sub: string | undefined, positionals: string[], options: Record<string, string | boolean | string[]>, home: string) {
  const id = () => requirePositional(positionals[2], 'host id');
  switch (sub) {
    case 'context-register': return registerExecutionContext({ home, id: resolveExecutionContextId(home), name: requirePositional(optionString(options.name), 'name') });
    case 'register': return registerHost({ id: id(), name: requirePositional(optionString(options.name), 'name'), harness: optionString(options.harness) ?? loadConfig(home).defaultHarness, capabilities: optionStrings(options.capability), enabled: options.disabled !== true }, home);
    case 'list': return listHosts(home);
    case 'grant': return grantHostWorkspace({ hostId: id(), projectId: requirePositional(optionString(options['project-id']), 'project id'), workspaceRef: requirePositional(optionString(options['workspace-ref']), 'workspace reference'), revoke: options.revoke === true }, home);
    case 'workspace':
      if ((options.available === true) === (options.unavailable === true)) throw new Error('Choose exactly one of --available or --unavailable');
      return declareHostWorkspace({ hostId: id(), projectId: requirePositional(optionString(options['project-id']), 'project id'), available: options.available === true, workingPath: optionString(options['working-path']) }, home);
    case 'discover': return discoverHostAttempts(id(), home);
    default: throw new Error('Unknown host action');
  }
}
