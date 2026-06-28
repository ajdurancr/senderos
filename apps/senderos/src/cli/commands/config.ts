import { loadConfig } from '../../config/runtime';
import { getConfigPath, updateConfigPath } from '../../services/runtime';
import { requirePositional } from '../shared';

const configShowHelp = {
  command: 'show',
  summary: 'Print the full Senderos config.',
  usage: ['senderos config show'],
};

const configGetHelp = {
  command: 'get',
  summary: 'Read a specific config path.',
  usage: ['senderos config get <config-path>'],
  arguments: [{ name: 'config-path', description: 'Dot path inside config.json.', required: true }],
};

const configSetHelp = {
  command: 'set',
  summary: 'Write a specific config path.',
  usage: ['senderos config set <config-path> <value>'],
  arguments: [
    { name: 'config-path', description: 'Dot path inside config.json.', required: true },
    { name: 'value', description: 'String value to assign at the path.', required: true },
  ],
};

export const configCommandHelp = {
  command: 'config',
  summary: 'Inspect or update Senderos configuration.',
  usage: ['senderos config <show|get|set> ...'],
  subcommands: [configShowHelp, configGetHelp, configSetHelp],
};

export function handleConfig(sub: string | undefined, positionals: string[], home: string) {
  switch (sub) {
    case 'show':
      return loadConfig(home);
    case 'get': {
      const path = requirePositional(positionals[2], 'config path');
      return { path, value: getConfigPath(path, home) };
    }
    case 'set': {
      const path = requirePositional(positionals[2], 'config path');
      const value = requirePositional(positionals[3], 'config value');
      return updateConfigPath(path, value, home);
    }
    default:
      throw new Error('Unknown config action');
  }
}
