import type { SenderosConfig, DbAdapter } from '../domain/types';
import { resolveRuntime } from '../config/runtime';
import { localSqliteAdapter, openLocalSqlite } from '../adapters/db/local-sqlite';
import { tursoAdapter } from '../adapters/db/turso';

export function resolveDbAdapter(kind: SenderosConfig['database']['kind']): DbAdapter {
  switch (kind) {
    case 'turso':
      return tursoAdapter;
    case 'local':
    default:
      return localSqliteAdapter;
  }
}

export function describeCurrentDb(home?: string) {
  const { config } = resolveRuntime(home);
  return resolveDbAdapter(config.database.kind).describe(home);
}

export function healthcheckCurrentDb(home?: string) {
  const { config } = resolveRuntime(home);
  return resolveDbAdapter(config.database.kind).healthcheck(home);
}

export function openDb(home?: string) {
  const { config } = resolveRuntime(home);

  if (config.database.kind === 'local') {
    return openLocalSqlite(home);
  }

  throw new Error(
    'The Turso adapter is built in and current for configuration and health checks, but live command execution still uses the synchronous local SQLite path. Switch the runtime execution path to async/libsql before using Turso as the active backend.'
  );
}
