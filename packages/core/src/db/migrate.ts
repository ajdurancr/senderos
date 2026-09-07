import { migrate } from 'drizzle-orm/libsql/migrator';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { openRuntimeDb } from './client';

export async function migrateRuntimeDb(home?: string) {
  await migrate(openRuntimeDb(home), {
    migrationsFolder: resolve(dirname(fileURLToPath(import.meta.url)), '../../drizzle'),
  });
}
