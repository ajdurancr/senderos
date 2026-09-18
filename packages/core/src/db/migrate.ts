import { migrate } from 'drizzle-orm/libsql/migrator';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { openRuntimeDb } from './client';

export async function migrateRuntimeDb(home?: string) {
  const moduleDirectory = dirname(fileURLToPath(import.meta.url));
  const packagedMigrations = resolve(moduleDirectory, 'drizzle');
  const sourceMigrations = resolve(moduleDirectory, '../../drizzle');
  await migrate(openRuntimeDb(home), {
    migrationsFolder: existsSync(packagedMigrations)
      ? packagedMigrations
      : sourceMigrations,
  });
}
