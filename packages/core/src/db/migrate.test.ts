import { expect, test } from 'bun:test';

import { initHome } from '../test-support/runtime';
import { migrateRuntimeDb } from './migrate';

test('migrateRuntimeDb can safely reapply the bundled migrations', async () => {
  const home = await initHome();

  await expect(migrateRuntimeDb(home)).resolves.toBeUndefined();
});
