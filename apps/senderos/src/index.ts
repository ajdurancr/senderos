export * from './domain/types';
export * from './config/runtime';
export * from './services/loop';
export * from './services/runtime';

import { runCli } from './services/runtime';

if (import.meta.main) await runCli();
