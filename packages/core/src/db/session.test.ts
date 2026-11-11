import { expect, test } from 'bun:test';
import { createClient } from '@libsql/client';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { atomic, openRuntimeDb, withDatabaseConnection, withRuntimeDatabaseSession } from './client';

test('owns environment clients, including failure cleanup, while nested sessions borrow the owner', async () => {
  mkdirSync(tmpdir(), { recursive: true });
  const directory = mkdtempSync(join(tmpdir(), 'senderos-session-'));
  const previous = process.env.SENDEROS_DATABASE_URL;
  process.env.SENDEROS_DATABASE_URL = `file:${join(directory, 'session.db')}`;
  let owned: ReturnType<typeof openRuntimeDb> | undefined;
  try {
    expect(await withRuntimeDatabaseSession(async () => {
      owned = openRuntimeDb();
      await owned.$client.execute('CREATE TABLE facts (value TEXT)');
      await withRuntimeDatabaseSession(async () => {
        await owned!.$client.execute("INSERT INTO facts VALUES ('retained')");
      });
      expect(owned.$client.closed).toBe(false);
      return 'complete';
    })).toBe('complete');
    expect(owned!.$client.closed).toBe(true);
    const failure = new Error('synthetic session failure');
    await expect(withRuntimeDatabaseSession(async () => {
      owned = openRuntimeDb();
      expect((await owned.$client.execute('SELECT value FROM facts')).rows[0]?.value).toBe('retained');
      throw failure;
    })).rejects.toBe(failure);
    expect(owned!.$client.closed).toBe(true);
  } finally {
    if (previous === undefined) delete process.env.SENDEROS_DATABASE_URL;
    else process.env.SENDEROS_DATABASE_URL = previous;
    owned?.$client.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('borrows scoped overrides and active transactions without closing or changing their connection', async () => {
  await withDatabaseConnection({ url: 'file::memory:' }, async () => {
    await atomic(undefined, async () => {
      const transaction = openRuntimeDb();
      await withRuntimeDatabaseSession(async () => {
        expect(openRuntimeDb()).toBe(transaction);
        await transaction.$client.execute('CREATE TABLE facts (value TEXT)');
      });
      expect(transaction.$client.closed).toBe(false);
      await transaction.$client.execute("INSERT INTO facts VALUES ('committed')");
    });
    const db = openRuntimeDb();
    expect(db.$client.closed).toBe(false);
  });
});


test('exhausted native read contention closes the owned reader and permits later explicit recovery', async () => {
  mkdirSync(tmpdir(), { recursive: true });
  const directory = mkdtempSync(join(tmpdir(), 'senderos-session-locked-'));
  const previous = process.env.SENDEROS_DATABASE_URL;
  const url = `file:${join(directory, 'locked.db')}`;
  process.env.SENDEROS_DATABASE_URL = url;
  const owner = createClient({ url });
  let reader: ReturnType<typeof openRuntimeDb> | undefined;
  try {
    await owner.execute('CREATE TABLE facts (value TEXT)');
    await owner.execute("INSERT INTO facts VALUES ('retained')");
    await owner.execute('BEGIN EXCLUSIVE');
    try {
      await expect(withRuntimeDatabaseSession(async () => {
        reader = openRuntimeDb();
        await reader.$client.execute('SELECT value FROM facts');
      })).rejects.toMatchObject({ code: 'SQLITE_BUSY' });
      expect(reader!.$client.closed).toBe(true);
      expect(owner.closed).toBe(false);
    } finally { await owner.execute('ROLLBACK'); }
    await withRuntimeDatabaseSession(async () => {
      const recovered = openRuntimeDb();
      expect((await recovered.$client.execute('SELECT value FROM facts')).rows[0]?.value).toBe('retained');
      await atomic(undefined, async () => {
        await openRuntimeDb().$client.execute("INSERT INTO facts VALUES ('recovered')");
      });
      expect((await recovered.$client.execute('SELECT COUNT(*) AS count FROM facts')).rows[0]?.count).toBe(2);
    });
  } finally {
    if (previous === undefined) delete process.env.SENDEROS_DATABASE_URL;
    else process.env.SENDEROS_DATABASE_URL = previous;
    reader?.$client.close();
    owner.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
