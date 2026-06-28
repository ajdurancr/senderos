import { afterEach, describe, expect, mock, test } from 'bun:test';
const createClient = mock(() => ({ closed: false }));
mock.module('@libsql/client', () => ({ createClient }));
import { tursoAdapter } from './turso';
import { initializeRuntime } from '../../config/runtime';
import { tempHome, tursoConfigForHome } from '../../../tests/helpers/runtime';

afterEach(() => { createClient.mockClear(); delete process.env.SENDEROS_TURSO_TOKEN; });

describe('turso adapter', () => {
  test('describes and healthchecks turso configuration', () => {
    const home = tempHome();
    process.env.SENDEROS_TURSO_TOKEN = 'token';
    initializeRuntime(home, tursoConfigForHome(home));
    expect(tursoAdapter.describe(home)).toEqual({ kind: 'turso', url: 'libsql://senderos.example.turso.io', authTokenEnv: 'SENDEROS_TURSO_TOKEN' });
    expect(tursoAdapter.healthcheck(home)).toEqual({ ok: true, issues: [], warnings: [] });
    expect(createClient).toHaveBeenCalled();
  });

  test('warns or throws for unsupported command connection path', () => {
    const home = tempHome();
    initializeRuntime(home, tursoConfigForHome(home));
    expect(tursoAdapter.healthcheck(home).warnings).toContain('env:SENDEROS_TURSO_TOKEN is not set in this shell');
    expect(() => tursoAdapter.openCommandConnection!()).toThrow();
  });
});
