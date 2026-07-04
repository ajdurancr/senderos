import { parseArgs } from './args';
import { resolveHome } from './shared';
import { handleAgent, handleAgentRun, handleSendero } from './commands/agent';
import { handleConfig } from './commands/config';
import { handleFeature } from './commands/feature';
import { handleInit } from './commands/init';
import { handleProject } from './commands/project';
import { handleLoop } from './commands/loop';
import { handleRun } from './commands/run';
import { handleSession } from './commands/session';
import { handleSystemCommand } from './commands/system';
import { resolveHelp } from './help';

export async function runCli(argv = process.argv.slice(2)) {
  const { positionals, options } = parseArgs(argv);
  const cmd = positionals[0];
  const sub = positionals[1];
  const home = resolveHome(options.home);

  try {
    let result: unknown;

    switch (cmd) {
      case 'init':
        result = await handleInit(options);
        break;
      case 'config':
        result = handleConfig(sub, positionals, home);
        break;
      case 'project':
        result = handleProject(sub, positionals, options, home);
        break;
      case 'agent':
        result = handleAgent(sub, positionals, home);
        break;
      case 'sendero':
        result = handleSendero(sub, positionals, options, home);
        break;
      case 'agent-run':
        result = handleAgentRun(sub, positionals, options, home);
        break;
      case 'feature':
        result = handleFeature(sub, positionals, options, home);
        break;
      case 'loop':
        result = handleLoop(sub, positionals, home);
        break;
      case 'run':
        result = handleRun(sub, positionals, home);
        break;
      case 'session':
        result = handleSession(sub, positionals, home);
        break;
      case 'help':
        result = resolveHelp(positionals[1]);
        break;
      case 'doctor':
      case 'status':
      case 'reconcile':
      case 'schedule-plan':
        result = handleSystemCommand(cmd, home);
        break;
      default:
        throw new Error(`Unknown command: ${cmd}`);
    }

    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(JSON.stringify({ error: (error as Error).message }, null, 2));
    process.exitCode = 1;
  }
}
