import { describe, expect, test } from 'bun:test';
import {
  describeCurrentDb,
  healthcheckCurrentDb,
  openRuntimeDb,
} from './client';
import { initHome } from '../test-support/runtime';

describe('db client', () => {
  test('describes the environment-backed connection', async () => {
    const home = await initHome();
    expect(describeCurrentDb(home)).toMatchObject({
      urlEnv: 'SENDEROS_DATABASE_URL',
      url: `file:${home}/senderos.db`,
    });
  });

  test('healthcheckCurrentDb reports a healthy runtime database', async () => {
    const home = await initHome();
    expect((await healthcheckCurrentDb(home)).ok).toBe(true);
  });

  test('openRuntimeDb returns a usable libSQL connection', async () => {
    const home = await initHome();
    const db = openRuntimeDb(home) as any;
    expect(await db.get('select 1 as value')).toEqual({ value: 1 });
    db.$client.close();
  });
});
