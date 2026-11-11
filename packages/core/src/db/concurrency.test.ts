import { expect, test } from 'bun:test';
import { sql } from 'drizzle-orm';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { atomic, openRuntimeDb, withDatabaseConnection } from './client';

test('independent writers yield so an in-process transaction can release its lock', async () => {
  mkdirSync(tmpdir(), { recursive: true });
  const directory = mkdtempSync(join(tmpdir(), 'senderos-contention-'));
  try {
    await withDatabaseConnection({ url: `file:${join(directory, 'test.db')}` }, async () => {
      const db = openRuntimeDb();
      await db.$client.execute('CREATE TABLE counter (value INTEGER NOT NULL)');
      await db.$client.execute('INSERT INTO counter VALUES (0)');
      let ownerStarted!: () => void;
      const started = new Promise<void>(resolve => { ownerStarted = resolve; });
      const owner = atomic(undefined, async () => {
        await openRuntimeDb().run(sql`UPDATE counter SET value = value + 1`);
        ownerStarted();
        // A native synchronous busy wait must not starve this lock release.
        await new Promise(resolve => setTimeout(resolve, 25));
      });
      await started;
      const contender = atomic(undefined, async () => {
        await openRuntimeDb().run(sql`UPDATE counter SET value = value + 1`);
      });
      const results = await Promise.allSettled([owner, contender]);
      expect(results.map(result => result.status)).toEqual(['fulfilled', 'fulfilled']);
      expect((await db.$client.execute('SELECT value FROM counter')).rows[0]?.value).toBe(2);
    });
  } finally { rmSync(directory, { recursive: true, force: true }); }
}, 15000);

test('a busy commit rolls back before retrying without duplicating its write', async () => {
  mkdirSync(tmpdir(), { recursive: true });
  const directory = mkdtempSync(join(tmpdir(), 'senderos-commit-contention-'));
  try {
    await withDatabaseConnection({ url: `file:${join(directory, 'test.db')}` }, async () => {
      const db = openRuntimeDb();
      await db.$client.execute('CREATE TABLE counter (value INTEGER NOT NULL)');
      await db.$client.execute('INSERT INTO counter VALUES (0)');
      const reader = await db.$client.transaction('read');
      await reader.execute('SELECT * FROM counter');
      const released = new Promise<void>((resolve, reject) => {
        setTimeout(() => { reader.rollback().then(resolve, reject); }, 25);
      });
      let calls = 0;
      await atomic(undefined, async () => {
        calls++;
        await openRuntimeDb().run(sql`UPDATE counter SET value = value + 1`);
      });
      await released;
      expect(calls).toBeGreaterThan(1);
      expect((await db.$client.execute('SELECT value FROM counter')).rows[0]?.value).toBe(1);
    });
  } finally { rmSync(directory, { recursive: true, force: true }); }
}, 15000);

test('non-contention errors roll back and are never replayed', async () => {
  mkdirSync(tmpdir(), { recursive: true });
  const directory = mkdtempSync(join(tmpdir(), 'senderos-rollback-'));
  try {
    await withDatabaseConnection({ url: `file:${join(directory, 'test.db')}` }, async () => {
      const db = openRuntimeDb();
      await db.$client.execute('CREATE TABLE counter (value INTEGER NOT NULL)');
      await db.$client.execute('INSERT INTO counter VALUES (0)');
      let calls = 0;
      const failure = new Error('deliberate application failure');
      await expect(atomic(undefined, async () => {
        calls++;
        await openRuntimeDb().run(sql`UPDATE counter SET value = value + 1`);
        throw failure;
      })).rejects.toBe(failure);
      expect(calls).toBe(1);
      expect((await db.$client.execute('SELECT value FROM counter')).rows[0]?.value).toBe(0);
    });
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('exhausted commit contention leaves no partial write and permits later recovery', async () => {
  mkdirSync(tmpdir(), { recursive: true });
  const directory = mkdtempSync(join(tmpdir(), 'senderos-lock-exhaustion-'));
  try {
    await withDatabaseConnection({ url: `file:${join(directory, 'test.db')}` }, async () => {
      const db = openRuntimeDb();
      await db.$client.execute('CREATE TABLE counter (value INTEGER NOT NULL)');
      await db.$client.execute('INSERT INTO counter VALUES (0)');
      const reader = await db.$client.transaction('read');
      await reader.execute('SELECT * FROM counter');
      try {
        await expect(atomic(undefined, async () => {
          await openRuntimeDb().run(sql`UPDATE counter SET value = value + 1`);
        })).rejects.toMatchObject({ code: 'SQLITE_BUSY' });
      } finally { await reader.rollback(); }
      expect((await db.$client.execute('SELECT value FROM counter')).rows[0]?.value).toBe(0);
      await atomic(undefined, async () => {
        await openRuntimeDb().run(sql`UPDATE counter SET value = value + 1`);
      });
      expect((await db.$client.execute('SELECT value FROM counter')).rows[0]?.value).toBe(1);
    });
  } finally { rmSync(directory, { recursive: true, force: true }); }
}, 15000);


test('standalone reads yield through a brief exclusive lock without replaying mutations', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'senderos-read-contention-'));
  try {
    await withDatabaseConnection({ url: `file:${join(directory, 'test.db')}` }, async () => {
      const owner = openRuntimeDb();
      const reader = openRuntimeDb();
      await owner.$client.execute('CREATE TABLE facts (id TEXT PRIMARY KEY, value INTEGER)');
      await owner.$client.execute("INSERT INTO facts VALUES ('retained', 1)");
      await owner.$client.execute('BEGIN EXCLUSIVE');
      await owner.$client.execute('UPDATE facts SET value = 2');
      // The reader begins while the lock is held. Releasing it needs the event
      // loop, so a synchronous SQLite busy timeout cannot satisfy this test.
      const released = new Promise<void>((resolve, reject) => {
        setTimeout(() => { owner.$client.executeMultiple('COMMIT').then(resolve, reject); }, 50);
      });
      try {
        const result = await reader.$client.execute('SELECT id, value FROM facts');
        expect(result.rows.map(row => ({ id: row.id, value: row.value }))).toEqual([{ id: 'retained', value: 2 }]);
      } finally { await released; }
      expect((await reader.$client.execute('SELECT COUNT(*) AS count FROM facts')).rows[0]?.count).toBe(1);
    });
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('persistent local read contention fails honestly and the retained facts remain readable after release', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'senderos-read-exhaustion-'));
  try {
    await withDatabaseConnection({ url: `file:${join(directory, 'test.db')}` }, async () => {
      const owner = openRuntimeDb();
      const reader = openRuntimeDb();
      await owner.$client.execute('CREATE TABLE facts (value TEXT)');
      await owner.$client.execute("INSERT INTO facts VALUES ('complete retained history')");
      await owner.$client.execute('BEGIN EXCLUSIVE');
      try { await expect(reader.$client.execute('SELECT * FROM facts')).rejects.toMatchObject({ code: 'SQLITE_BUSY' }); }
      finally { await owner.$client.executeMultiple('ROLLBACK'); }
      expect((await reader.$client.execute('SELECT * FROM facts')).rows.map(row => ({ value: row.value }))).toEqual([{ value: 'complete retained history' }]);
      await atomic(undefined, async () => {
        const transaction = openRuntimeDb();
        await transaction.$client.execute("INSERT INTO facts VALUES ('transaction fact')");
        expect((await transaction.$client.execute('SELECT COUNT(*) AS count FROM facts')).rows[0]?.count).toBe(2);
      });
      expect((await reader.$client.execute('SELECT COUNT(*) AS count FROM facts')).rows[0]?.count).toBe(2);
    });
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
