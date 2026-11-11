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

test('context registration waits for an independent file writer instead of failing with SQLITE_BUSY', async () => {
  const { initHome } = await import('../../test-support/runtime');
  const { openRuntimeDb } = await import('../../db/client');
  const home = await initHome();
  const writer = openRuntimeDb(home);
  await writer.$client.execute('BEGIN IMMEDIATE');
  const pending = registerExecutionContext({ home, id: 'after-writer', name: 'After writer' });
  // Attach both handlers immediately so the baseline rejection is observed.
  const settled = pending.then(() => 'registered', () => 'rejected');
  try {
    expect(await Promise.race([settled, new Promise(resolve => setTimeout(() => resolve('waiting'), 50))])).toBe('waiting');
  } finally {
    await writer.$client.executeMultiple('ROLLBACK');
    writer.$client.close();
  }
  expect(await pending).toMatchObject({ id: 'after-writer', name: 'After writer' });
  expect(await registerExecutionContext({ home, id: 'after-writer', name: 'After writer' })).toMatchObject({ id: 'after-writer' });
});

test('simultaneous context names serialize their validation and preserve a single record', async () => {
  const { initHome } = await import('../../test-support/runtime');
  const home = await initHome();
  const results = await Promise.allSettled(['name-first', 'name-second'].map(id => registerExecutionContext({ home, id, name: 'One shared name' })));
  expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
  const failure = results.find(result => result.status === 'rejected') as PromiseRejectedResult;
  expect(failure.reason.message).toContain('name is already in use');
});
