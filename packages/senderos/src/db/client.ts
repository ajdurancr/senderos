import type { Database } from 'bun:sqlite';
import type { DbAdapter, SenderosConfig } from '../shared/types';
import { resolveRuntime } from '../shared/config';
import { localSqliteAdapter } from './adapters/local-sqlite';
import { tursoAdapter } from './adapters/turso';

export function resolveDbAdapter(
  kind: SenderosConfig['database']['kind'],
): DbAdapter {
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

export function openRuntimeDb(home?: string): Database {
  const adapter = resolveConfiguredDbAdapter(home);

  /* c8 ignore next 4 -- exercised branch is not attributed by Bun's coverage output. */
  if (!adapter.openCommandConnection) {
    throw new Error(
      `Database adapter ${adapter.kind} does not expose a command execution connection.`,
    );
  }

  return adapter.openCommandConnection(home) as Database;
}
