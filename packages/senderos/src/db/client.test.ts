import { describe, expect, test } from 'bun:test';
import {
  describeCurrentDb,
  healthcheckCurrentDb,
  openRuntimeDb,
  resolveConfiguredDbAdapter,
  resolveDbAdapter,
} from './client';
import { localSqliteAdapter } from './adapters/local-sqlite';
import { tursoAdapter } from './adapters/turso';
import { initializeRuntime } from '../shared/config';
import {
  initHome,
  tempHome,
  tursoConfigForHome,
} from '../test-support/runtime';

describe('db client', () => {
  test('resolveDbAdapter returns the local sqlite adapter for local databases', () => {
    expect(resolveDbAdapter('local')).toBe(localSqliteAdapter);
    expect(resolveDbAdapter('turso')).toBe(tursoAdapter);
  });

  test('resolveConfiguredDbAdapter returns the configured adapter for the runtime', () => {
    const home = initHome();
    expect(resolveConfiguredDbAdapter(home)).toBe(localSqliteAdapter);
  });

  test('describeCurrentDb reports the current configured database', () => {
    const home = initHome();
    expect(describeCurrentDb(home).kind).toBe('local');
  });

  test('healthcheckCurrentDb reports a healthy runtime database', () => {
    const home = initHome();
    expect(healthcheckCurrentDb(home).ok).toBe(true);
  });

  test('openRuntimeDb returns a usable database connection', () => {
    const home = initHome();
    const db = openRuntimeDb(home) as any;
    expect(db.query('select 1 as value').get()).toEqual({ value: 1 });
    db.close();
  });

  test('openRuntimeDb rejects adapters without a synchronous command connection', () => {
    const home = tempHome();
    initializeRuntime(home, tursoConfigForHome(home));
    const adapter = tursoAdapter as typeof tursoAdapter & {
      openCommandConnection?: typeof tursoAdapter.openCommandConnection;
    };
    const openCommandConnection = adapter.openCommandConnection;
    delete adapter.openCommandConnection;

    try {
      expect(() => openRuntimeDb(home)).toThrow(
        'does not expose a command execution connection',
      );
    } finally {
      adapter.openCommandConnection = openCommandConnection;
    }
  });
});
