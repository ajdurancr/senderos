import type { Database } from 'bun:sqlite';
import type { DbAdapter, SenderosConfig } from '../domain/types';
import { resolveRuntime } from '../config/runtime';
import { localSqliteAdapter } from '../adapters/db/local-sqlite';
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

export function resolveConfiguredDbAdapter(home?: string) {
  const { config } = resolveRuntime(home);
  return resolveDbAdapter(config.database.kind);
}

export function describeCurrentDb(home?: string) {
  return resolveConfiguredDbAdapter(home).describe(home);
}

export function healthcheckCurrentDb(home?: string) {
  return resolveConfiguredDbAdapter(home).healthcheck(home);
}

export function openConfiguredCommandDb(home?: string): Database {
  const adapter = resolveConfiguredDbAdapter(home);

  if (!adapter.openCommandConnection) {
    throw new Error(`Database adapter ${adapter.kind} does not expose a command execution connection.`);
  }

  return adapter.openCommandConnection(home) as Database;
}
