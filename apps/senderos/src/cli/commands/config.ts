import { loadConfig } from '../../config/runtime';
import { getConfigPath, updateConfigPath } from '../../services/runtime';
import { requirePositional } from '../shared';

export const configCommandHelp = {
  command: 'config',
  summary: 'Inspect or update Senderos configuration.',
  usage: [
    'senderos config show',
    'senderos config get database.kind',
    'senderos config set defaultHarness codex',
  ],
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
