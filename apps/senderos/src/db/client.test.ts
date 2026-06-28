import { describe, expect, test } from 'bun:test';
import { describeCurrentDb, healthcheckCurrentDb, openConfiguredCommandDb, resolveConfiguredDbAdapter, resolveDbAdapter } from './client';
import { localSqliteAdapter } from '../adapters/db/local-sqlite';
import { initHome } from '../../tests/helpers/runtime';

describe('db client', () => {
  test('resolves configured/local adapters and opens configured command db', () => {
    const home = initHome();
    expect(resolveDbAdapter('local')).toBe(localSqliteAdapter);
    expect(resolveConfiguredDbAdapter(home)).toBe(localSqliteAdapter);
    expect(describeCurrentDb(home).kind).toBe('local');
    expect(healthcheckCurrentDb(home).ok).toBe(true);
    const db = openConfiguredCommandDb(home) as any;
    expect(db.query("select 1 as value").get()).toEqual({ value: 1 });
    db.close();
  });
});
