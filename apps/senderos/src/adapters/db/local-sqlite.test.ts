import { describe, expect, test } from 'bun:test';
import { localSqliteAdapter } from './local-sqlite';
import { initHome, tempHome } from '../../../tests/helpers/runtime';

describe('local-sqlite adapter', () => {
  test('describes healthy local runtimes and reports missing config', () => {
    const home = initHome();
    expect(localSqliteAdapter.describe(home)).toEqual({ kind: 'local', dbPath: `${home}/senderos.db` });
    expect(localSqliteAdapter.healthcheck(home)).toEqual({ ok: true, issues: [] });
    expect(localSqliteAdapter.healthcheck(tempHome()).ok).toBe(false);
  });

  test('opens a command connection', () => {
    const home = initHome();
    const db = localSqliteAdapter.openCommandConnection!(home) as any;
    expect(db.query("select name from sqlite_master where type='table' and name='goals'").get()).toBeTruthy();
    db.close();
  });
});
