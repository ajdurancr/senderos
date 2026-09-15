import { expect, test } from 'bun:test';

import { defaultConfigForHome, initializeRuntime } from '../../shared/config';
import { tempHome } from '../../test-support/runtime';
import { registerExecutionContext } from './register';

test('execution context names are globally unique and ids can be re-registered', async () => {
  const home = tempHome();
  const config = defaultConfigForHome(home, 'codex', 'context-primary');
  process.env[config.database.urlEnv] = `file:${home}/senderos.db`;
  await initializeRuntime(home, config, undefined, 'Primary context');
  expect((await registerExecutionContext({ home, id: 'context-primary', name: 'Primary context' })).id).toBe('context-primary');
  await expect(registerExecutionContext({ home, id: 'context-other', name: 'Primary context' })).rejects.toThrow();
  await expect(registerExecutionContext({ home, id: 'context-primary', name: 'Renamed context' })).rejects.toThrow('already registered');
});
