import { expect, test } from 'bun:test';
import type { Client, InStatement, InArgs } from '@libsql/client';
import { retryLocalReads } from './read-contention';

const busy = Object.assign(new Error('synthetic lock failure'), { code: 'SQLITE_BUSY' });
function fixture(protocol = 'file', failure: unknown = busy, failures = 1) {
  let calls = 0;
  const result = { rows: [{ fact: 'retained' }] };
  const client = { protocol, async execute(..._args: unknown[]) { calls++; if (calls <= failures) throw failure; return result; } } as unknown as Client;
  return { client, result, calls: () => calls };
}

test('local SELECT retries preserve the exact result and statement arguments', async () => {
  const f = fixture();
  const original = f.client.execute;
  let received: unknown[] = [];
  f.client.execute = async (statement: InStatement, args?: InArgs) => { received = [statement, args]; return typeof statement === 'string' ? original(statement, args) : original(statement); };
  retryLocalReads(f.client, () => false);
  const statement = { sql: ' \nselect fact FROM retained WHERE id = ?', args: ['synthetic-id'] };
  expect(await f.client.execute(statement)).toBe(f.result as never);
  expect(received).toEqual([statement, undefined]);
  expect(f.calls()).toBe(2);
});

test.each([
  ['remote', 'https', 'SELECT 1', false, busy],
  ['mutation', 'file', 'UPDATE facts SET value = 2', false, busy],
  ['returning mutation', 'file', 'INSERT INTO facts VALUES (1) RETURNING *', false, busy],
  ['transaction', 'file', 'SELECT 1', true, busy],
  ['snapshot conflict', 'file', 'SELECT 1', false, Object.assign(new Error('stale'), { code: 'SQLITE_BUSY_SNAPSHOT' })],
  ['driver snapshot conflict', 'file', 'SELECT 1', false, Object.assign(new Error('stale driver snapshot'), { code: 'SQLITE_BUSY', extendedCode: 'SQLITE_BUSY_SNAPSHOT' })],
  ['non-error rejection', 'file', 'SELECT 1', false, null],
  ['ordinary error', 'file', 'SELECT 1', false, new Error('synthetic persistent failure')],
] as const)('does not replay %s', async (_name, protocol, sql, transaction, error) => {
  const f = fixture(protocol, error);
  retryLocalReads(f.client, () => transaction);
  await expect(f.client.execute(sql)).rejects.toBe(error);
  expect(f.calls()).toBe(1);
});

test('persistent contention propagates the original failure after a bounded wait', async () => {
  const f = fixture('file', busy, Infinity);
  retryLocalReads(f.client, () => false);
  const start = performance.now();
  await expect(f.client.execute('SELECT 1')).rejects.toBe(busy);
  expect(performance.now() - start).toBeGreaterThanOrEqual(1000);
  expect(performance.now() - start).toBeLessThan(2500);
  expect(f.calls()).toBeGreaterThan(1);
});

test.each([
  { code: 'SQLITE_BUSY_RECOVERY' },
  { code: 'SQLITE_BUSY', extendedCode: 'SQLITE_BUSY_RECOVERY' },
])('local recovery contention yields and then succeeds: %j', async codes => {
  const f = fixture('file', Object.assign(new Error('recovering'), codes));
  retryLocalReads(f.client, () => false);
  expect(await f.client.execute('SELECT 1')).toBe(f.result as never);
  expect(f.calls()).toBe(2);
});


test('string SELECT statements preserve separately supplied bindings', async () => {
  const f = fixture();
  const original = f.client.execute;
  let received: unknown[] = [];
  f.client.execute = async (statement: InStatement, args?: InArgs) => { received = [statement, args]; return typeof statement === 'string' ? original(statement, args) : original(statement); };
  retryLocalReads(f.client, () => false);
  expect(await f.client.execute('SELECT ?', ['retained-id'])).toBe(f.result as never);
  expect(received).toEqual(['SELECT ?', ['retained-id']]);
  expect(f.calls()).toBe(2);
});
