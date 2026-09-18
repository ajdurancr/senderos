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
import { handleSendero } from './commands/sendero';
import { resolveHelp } from './help';
import { resolveExecutionContextId } from '@senderos/core';

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

    const result = await (async () => {
      if (cmd !== 'init' && cmd !== 'bootstrap-agent-skill')
        resolveExecutionContextId(home);

      switch (cmd) {
      case 'init':
        return await handleInit(options);
      case 'bootstrap-agent-skill':
        return await handleBootstrapAgentSkill(options);
      case 'config':
        return await handleConfig(sub, positionals, home);
      case 'project':
        return await handleProject(sub, positionals, options, home);
      case 'agent':
        return await handleAgent(sub, positionals, home);
      case 'transition':
        return await handleTransition(sub, positionals, options, home);
      case 'sendero':
        return await handleSendero(sub, positionals, options, home);
      case 'goal':
        return await handleGoal(sub, positionals, options, home);
      case 'plan':
        return await handlePlan(options, home);
      case 'run':
        return await handleRun(sub, positionals, options, home);
      case 'attempt':
        return await handleAttempt(sub, positionals, options, home);
      case 'doctor':
      case 'status':
        return await handleSystemCommand(cmd, home);
      default:
        throw new Error(`Unknown command: ${cmd}`);
      }
    })();

    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(JSON.stringify({ error: (error as Error).message }, null, 2));
    process.exitCode = 1;
  }
}
