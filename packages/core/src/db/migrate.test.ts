import { expect, test } from 'bun:test';

import { listAgents } from '../commands';
import { prepareSharedDatabase } from './bootstrap';
import { initHome, tempHome } from '../test-support/runtime';
import { migrateRuntimeDb } from './migrate';

test('migrateRuntimeDb can safely reapply the bundled migrations', async () => {
  const home = await initHome();

  await expect(migrateRuntimeDb(home)).resolves.toBeUndefined();
});

test('prepareSharedDatabase migrates and seeds without a runtime config', async () => {
  const home = tempHome();
  process.env.SENDEROS_DATABASE_URL = `file:${home}/shared.db`;

  await expect(prepareSharedDatabase()).resolves.toBeUndefined();
  await expect(listAgents()).resolves.toHaveLength(5);
  await expect(prepareSharedDatabase()).resolves.toBeUndefined();
  await expect(listAgents()).resolves.toHaveLength(5);
});
