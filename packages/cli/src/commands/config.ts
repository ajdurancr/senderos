import { loadConfig } from '@senderos/senderos';
import { getConfigPath, updateConfigPath } from '@senderos/senderos';
import { requirePositional } from '../shared';

const configShowHelp = {
  command: 'show',
  summary: 'Print the full Senderos config.',
  agentDescription:
    'Use this to inspect the persisted Senderos configuration exactly as the runtime will load it. This is helpful for debugging environment and path issues.',
  usage: ['senderos config show'],
};

const configGetHelp = {
  command: 'get',
  summary: 'Read a specific config path.',
  agentDescription:
    'Use this when you need one exact configuration value without reading the whole config payload. The result is read-only and does not change runtime state.',
  usage: ['senderos config get <config-path>'],
  arguments: [
    {
      name: 'config-path',
      description: 'Dot path inside config.json.',
      required: true,
    },
  ],
};

const configSetHelp = {
  command: 'set',
  summary: 'Write a specific config path.',
  agentDescription:
    'Use this to mutate one configuration path in Senderos. This is an explicit state change and should only be used when configuration really needs to change.',
  usage: ['senderos config set <config-path> <value>'],
  arguments: [
    {
      name: 'config-path',
      description: 'Dot path inside config.json.',
      required: true,
    },
    {
      name: 'value',
      description: 'String value to assign at the path.',
      required: true,
    },
  ],
};

export const configCommandHelp = {
  command: 'config',
  summary: 'Inspect or update Senderos configuration.',
  agentDescription:
    'Use the config command to inspect or mutate persisted Senderos configuration values. This surface is for runtime setup state, not planning or dispatching work.',
  usage: ['senderos config <show|get|set> ...'],
  subcommands: [configShowHelp, configGetHelp, configSetHelp],
};

export function handleConfig(
  sub: string | undefined,
  positionals: string[],
  home: string,
) {
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
