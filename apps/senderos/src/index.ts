export * from './domain/types';
export * from './config/runtime';
export * from './services/runtime';
export * from './utils/harness';
export * from './cli/help';
export { runCli } from './cli/run';

import { runCli } from './cli/run';
if (import.meta.main) await runCli();
