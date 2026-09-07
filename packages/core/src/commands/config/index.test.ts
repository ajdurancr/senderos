import { describe, expect, test } from 'bun:test';
import { getConfigPath } from './get-path';
import { updateConfigPath } from './update-path';
import { initHome } from '../../test-support/runtime';
describe('runtime config operations', () => {
  test('reads and updates nested config paths', async () => {
    const home = await initHome();
    expect(await getConfigPath('output.format', home)).toBe('json');
    expect((await updateConfigPath('output.format', 'text', home)).output.format).toBe(
      'text',
    );
    expect(await getConfigPath('output.format', home)).toBe('text');
  });
});
