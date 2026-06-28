import { describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { migrate } from './schema';

describe('db schema', () => {
  test('creates tables', () => {
    const db = new Database(':memory:');
    migrate(db);
    expect(db.query("select name from sqlite_master where type='table' and name='projects'").get()).toBeTruthy();
    expect(db.query("select name from sqlite_master where type='table' and name='features'").get()).toBeTruthy();
    expect(db.query("select name from sqlite_master where type='table' and name='run_attempts'").get()).toBeTruthy();
    db.close();
  });
});
