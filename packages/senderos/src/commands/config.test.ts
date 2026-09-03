import { describe, expect, test } from 'bun:test';
import { getConfigPath, updateConfigPath } from './config';
import { initHome } from '../../tests/helpers/runtime';

describe('runtime config operations', () => {
  test('reads and updates nested config paths', () => {
    const home = initHome();
    expect(getConfigPath('output.format', home)).toBe('json');
    expect(updateConfigPath('output.format', 'text', home).output.format).toBe('text');
    expect(getConfigPath('output.format', home)).toBe('text');
  });
});
