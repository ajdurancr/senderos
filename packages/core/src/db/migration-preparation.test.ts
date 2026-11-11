import { expect, test } from 'bun:test';
import { DrizzleQueryError } from 'drizzle-orm/errors';
import { retryMigrationPreparation } from './migration-preparation';

const metadata = '\n CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (\n id SERIAL PRIMARY KEY,\n hash text NOT NULL,\n created_at numeric\n )\n';
const busy = { code: 'SQLITE_BUSY' };
const failure = (query = metadata, cause: unknown = busy) => new DrizzleQueryError(query, [], cause as Error);

test.each([busy, { code: 'SQLITE_BUSY_RECOVERY' }, { code: 'SQLITE_BUSY', extendedCode: 'SQLITE_BUSY_RECOVERY' }])('metadata preparation yields for local contention: %j', async cause => {
  let calls = 0;
  await retryMigrationPreparation('file', async () => { if (++calls === 1) throw failure(metadata, cause); });
  expect(calls).toBe(2);
});

test.each([
  ['remote metadata', 'https', failure()],
  ['migration DDL', 'file', failure('CREATE TABLE authored (id TEXT)')],
  ['migration insert', 'file', failure('INSERT INTO __drizzle_migrations VALUES (1)')],
  ['migration selection', 'file', failure('SELECT * FROM __drizzle_migrations')],
  ['batch failure', 'file', busy],
  ['snapshot conflict', 'file', failure(metadata, { code: 'SQLITE_BUSY', extendedCode: 'SQLITE_BUSY_SNAPSHOT' })],
  ['non-contention', 'file', failure(metadata, { code: 'SQLITE_CORRUPT' })],
  ['missing cause', 'file', failure(metadata, null)],
  ['non-error rejection', 'file', null],
  ['unknown metadata schema', 'file', failure(metadata.replace('numeric', 'text'))],
] as const)('does not replay %s', async (_name, protocol, error) => {
  let calls = 0;
  await expect(retryMigrationPreparation(protocol, async () => { calls++; throw error; })).rejects.toBe(error);
  expect(calls).toBe(1);
});

test('persistent metadata contention stays bounded and returns the final original error', async () => {
  let calls = 0;
  let last: unknown;
  const start = performance.now();
  try {
    await retryMigrationPreparation('file', async () => { calls++; last = failure(); throw last; });
    throw new Error('expected migration preparation failure');
  } catch (error) { expect(error).toBe(last); }
  expect(calls).toBeGreaterThan(1);
  expect(performance.now() - start).toBeGreaterThanOrEqual(1000);
  expect(performance.now() - start).toBeLessThan(2500);
});
