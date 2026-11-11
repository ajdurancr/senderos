import { afterAll, expect, test, vi } from 'vitest';
import { createClient, type Client } from '@libsql/client';
import { mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.env.SENDEROS_TEST_RUNTIME_ROOT ?? resolve(import.meta.dirname, '../../../../../.tmp/test-runtime'), `client-lifetime-${crypto.randomUUID()}`);
mkdirSync(root, { recursive: true });
process.env.SENDEROS_DATABASE_URL = `file:${resolve(root, 'isolated.db')}`;
afterAll(() => rmSync(root, { recursive: true, force: true }));

test('closes every observed snapshot client after complete results without changing persisted data', async () => {
  const { missionControlData } = await import('./server');
  const before = await missionControlData();
  const probe = createClient({ url: process.env.SENDEROS_DATABASE_URL! });
  const prototype = Object.getPrototypeOf(probe);
  const execute = prototype.execute;
  const clients = new Set<Client>();
  const spy = vi.spyOn(prototype, 'execute').mockImplementation(function(this: Client, ...args: unknown[]) {
    clients.add(this);
    return execute.apply(this, args);
  });
  try {
    for (let i = 0; i < 3; i++) {
      const snapshot = await missionControlData();
      expect({ ...snapshot, asOf: 0 }).toEqual({ ...before, asOf: 0 });
      expect(clients.size).toBeGreaterThan(0);
      expect([...clients].filter(client => !client.closed)).toHaveLength(0);
    }
  } finally {
    spy.mockRestore();
    for (const client of clients) client.close();
    probe.close();
  }
});

test('drains delayed sibling reads before closing clients and reports the original query failure', async () => {
  const { missionControlData } = await import('./server');
  const before = await missionControlData();
  const probe = createClient({ url: process.env.SENDEROS_DATABASE_URL! });
  const prototype = Object.getPrototypeOf(probe);
  const execute = prototype.execute;
  const clients = new Set<Client>();
  const failure = new Error('synthetic snapshot branch failure');
  let release!: () => void;
  let failed!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const failureReached = new Promise<void>(resolve => { failed = resolve; });
  let held = false;
  let injected = false;
  let siblingFinished = false;
  const spy = vi.spyOn(prototype, 'execute').mockImplementation(async function(this: Client, ...args: unknown[]) {
    clients.add(this);
    const statement = typeof args[0] === 'string' ? args[0] : (args[0] as { sql: string }).sql;
    if (!held && /from "execution_contexts"/.test(statement)) {
      held = true;
      await gate;
      const result = await execute.apply(this, args);
      siblingFinished = true;
      return result;
    }
    if (held && !injected && /from "agents"/.test(statement)) {
      injected = true;
      failed();
      throw failure;
    }
    return execute.apply(this, args);
  });
  let completed = false;
  const result = missionControlData().catch(error => { completed = true; return error; });
  try {
    await failureReached;
    await Promise.resolve();
    await Promise.resolve();
    expect(completed).toBe(false);
    expect(siblingFinished).toBe(false);
    release();
    const error = await result;
    expect(error.cause).toBe(failure);
    expect(siblingFinished).toBe(true);
    expect(clients.size).toBeGreaterThan(0);
    expect([...clients].filter(client => !client.closed)).toHaveLength(0);
  } finally {
    release();
    await result;
    spy.mockRestore();
    for (const client of clients) client.close();
    probe.close();
  }
  expect({ ...await missionControlData(), asOf: 0 }).toEqual({ ...before, asOf: 0 });
});
