import { parseArgs } from './args';
import { resolveHome } from './shared';
import { handleBootstrapAgentSkill } from './commands/bootstrap-agent-skill';
import { handleConfig } from './commands/config';
import { handleGoal } from './commands/goal';
import { handleInit } from './commands/init';
import { handleAgent } from './commands/agent';
import { handlePlan } from './commands/plan';
import { handleProject } from './commands/project';
import { handleRun } from './commands/run';
import { handleTransition } from './commands/transition';
import { handleAttempt } from './commands/attempt';
import { handleSystemCommand } from './commands/system';
import { resolveHelp } from './help';

export async function runCli(argv = process.argv.slice(2)) {
  const { positionals, options } = parseArgs(argv);
  const cmd = positionals[0];
  const sub = positionals[1];
  const home = resolveHome(options.home);

  try {
    if (options.help || cmd === 'help') {
      const helpCommand = cmd === 'help' ? positionals[1] : cmd;
      const helpSubcommand = cmd === 'help' ? positionals[2] : sub;
      const result = resolveHelp(helpCommand, helpSubcommand, {
        omitAgentDescription: Boolean(options['omit-agent-description']),
      });
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    let result: unknown;

    switch (cmd) {
      case 'init':
        result = await handleInit(options);
        break;
      case 'bootstrap-agent-skill':
        result = await handleBootstrapAgentSkill(options);
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
      case 'transition':
        result = handleTransition(sub, positionals, options, home);
        break;
      case 'goal':
        result = handleGoal(sub, positionals, options, home);
        break;
      case 'plan':
        result = handlePlan(options, home);
        break;
      case 'run':
        result = handleRun(sub, positionals, options, home);
        break;
      case 'attempt':
        result = handleAttempt(sub, positionals, options, home);
        break;
      case 'doctor':
      case 'status':
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
