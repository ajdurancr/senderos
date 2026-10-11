import { migrate } from 'drizzle-orm/libsql/migrator';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { openRuntimeDb } from './client';

export function runtimeMigrationsFolder() {
  const moduleDirectory = dirname(fileURLToPath(import.meta.url));
  const packagedMigrations = resolve(moduleDirectory, 'drizzle');
  const sourceMigrations = resolve(moduleDirectory, '../../drizzle');
  return existsSync(packagedMigrations) ? packagedMigrations : sourceMigrations;
}

export async function migrateRuntimeDb(home?: string) {
  await migrate(openRuntimeDb(home), { migrationsFolder: runtimeMigrationsFolder() });
}
