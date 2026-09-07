import { describe, expect, test } from 'bun:test';
import { handleConfig } from './config';
import { initHome } from '../../../core/src/test-support/runtime';

describe('config command', () => {
  test('show returns the complete persisted config', async () => {
    const home = await initHome();
    expect((await (handleConfig as any)('show', [], home)).database.urlEnv).toBe('SENDEROS_DATABASE_URL');
  });

  test('get returns an individual config path', async () => {
    const home = await initHome();
    expect(
      await (handleConfig as any)('get', ['config', 'get', 'output.format'], home),
    ).toEqual({ path: 'output.format', value: 'json' });
  });

  test('set persists a config path', async () => {
    const home = await initHome();
    expect(
      (await (handleConfig as any)(
        'set',
        ['config', 'set', 'defaultHarness', 'codex'],
        home,
      )).defaultHarness,
    ).toBe('codex');
  });

  test('rejects unknown actions and missing arguments', async () => {
    const home = await initHome();
    await expect((handleConfig as any)('wat', [], home)).rejects.toThrow(
      'Unknown config action',
    );
    await expect((handleConfig as any)('get', ['config', 'get'], home)).rejects.toThrow(
      'Missing required argument: config path',
    );
  });
});
