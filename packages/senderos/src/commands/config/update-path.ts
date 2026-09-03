import { writeFileSync } from 'node:fs';
import {
  configPathForHome,
  defaultHomePath,
  loadConfig,
} from '../../shared/config';
export function updateConfigPath(
  path: string,
  value: any,
  home = defaultHomePath(),
) {
  const cfg = loadConfig(home);
  const parts = path.split('.');
  let current: any = cfg;
  for (let i = 0; i < parts.length - 1; i++) {
    current[parts[i]] ??= {};
    current = current[parts[i]];
  }
  current[parts[parts.length - 1]] = value;
  writeFileSync(configPathForHome(home), JSON.stringify(cfg, null, 2));
  return cfg;
}
