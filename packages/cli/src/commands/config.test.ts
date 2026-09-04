import { describe, expect, test } from 'bun:test';
import { handleConfig } from './config';
import { initHome } from '../../../core/src/test-support/runtime';

describe('config command', () => {
  test('show returns the complete persisted config', () => {
    const home = initHome();
    expect((handleConfig as any)('show', [], home).database.kind).toBe('local');
  });

  test('get returns an individual config path', () => {
    const home = initHome();
    expect(
      (handleConfig as any)('get', ['config', 'get', 'output.format'], home),
    ).toEqual({ path: 'output.format', value: 'json' });
  });

  test('set persists a config path', () => {
    const home = initHome();
    expect(
      (handleConfig as any)(
        'set',
        ['config', 'set', 'defaultHarness', 'codex'],
        home,
      ).defaultHarness,
    ).toBe('codex');
  });

  test('rejects unknown actions and missing arguments', () => {
    const home = initHome();
    expect(() => (handleConfig as any)('wat', [], home)).toThrow(
      'Unknown config action',
    );
    expect(() => (handleConfig as any)('get', ['config', 'get'], home)).toThrow(
      'Missing required argument: config path',
    );
  });
});
