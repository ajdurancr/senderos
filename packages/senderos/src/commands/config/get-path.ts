import { defaultHomePath, loadConfig } from '../../shared/config';
export function getConfigPath(path: string, home = defaultHomePath()) { const cfg = loadConfig(home) as any; return path.split('.').reduce((acc: any, key: string) => acc?.[key], cfg); }
