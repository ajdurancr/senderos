import { expect, test } from 'bun:test';
import { handleSystemCommand } from './system';
import { initHome } from '../../../core/src/test-support/runtime';

test('system commands report status and health', () => {
  const home = initHome();
  expect((handleSystemCommand as any)('doctor', home).ok).toBe(true);
  expect((handleSystemCommand as any)('status', home).openGoals).toBe(0);
});
