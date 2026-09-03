import { expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { migrate } from './schema';

test('schema creates only the current orchestration tables', () => {
  const database = new Database(':memory:');
  migrate(database);
  const names = database
    .query("select name from sqlite_master where type='table' order by name")
    .all()
    .map((row: any) => row.name);
  expect(names).toEqual([
    'agent_transitions',
    'agents',
    'events',
    'goals',
    'projects',
    'run_attempts',
    'runs',
  ]);
});
