import { describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';

import { migrate } from './schema';

function hasTable(db: Database, name: string) {
  return db.query("select name from sqlite_master where type='table' and name=?").get(name);
}

describe('db schema', () => {
  test('creates tables', () => {
    const db = new Database(':memory:');
    migrate(db);

    expect(hasTable(db, 'projects')).toBeTruthy();
    expect(hasTable(db, 'features')).toBeTruthy();
    expect(hasTable(db, 'agents')).toBeTruthy();
    expect(hasTable(db, 'senderos')).toBeTruthy();
    expect(hasTable(db, 'run_executions')).toBeTruthy();

    db.close();
  });
});
