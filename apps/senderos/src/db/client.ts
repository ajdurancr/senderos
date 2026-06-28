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

export function openLocalDb(home?: string) {
  const { config } = resolveRuntime(home);

  if (config.database.kind !== 'local') {
    throw new Error(
      'This code path requires the local SQLite adapter. Turso is configured through the built-in adapter layer, but these runtime operations still execute through the local synchronous database path.'
    );
  }

  return openLocalSqlite(home);
}
