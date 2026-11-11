import { DrizzleQueryError } from 'drizzle-orm/errors';

// This is Drizzle's first, idempotent statement, before migration selection or
// the transactional migration batch. Fail closed if the driver changes it.
const metadataCreate = 'CREATE TABLE IF NOT EXISTS "__drizzle_migrations" ( id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric )';

/** Yield only when the local migrator cannot start its metadata preparation. */
export async function retryMigrationPreparation(protocol: string, migrate: () => Promise<void>) {
  const deadline = performance.now() + 1000;
  let delay = 5;
  for (;;) {
    try {
      await migrate();
      return;
    }
    catch (error) {
      const cause = error instanceof DrizzleQueryError
        ? error.cause as { code?: string; extendedCode?: string } | null : null;
      const code = cause?.extendedCode ?? cause?.code;
      if (protocol !== 'file' || !(error instanceof DrizzleQueryError)
        || error.query.trim().replace(/\s+/g, ' ') !== metadataCreate
        || (code !== 'SQLITE_BUSY' && code !== 'SQLITE_BUSY_RECOVERY')
        || performance.now() >= deadline) throw error;
    }
    await new Promise(resolve => setTimeout(resolve, Math.min(delay, Math.max(0, deadline - performance.now()))));
    delay = Math.min(delay * 2, 100);
  }
}
