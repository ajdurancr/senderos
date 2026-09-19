import { expect, test } from 'bun:test';
import { handleSystemCommand } from './system';
import { initHome } from '../../../core/src/test-support/runtime';

test('system commands report status and health', async () => {
  const home = await initHome();
  expect(await handleSystemCommand('doctor', home)).toMatchObject({ ok: true });
  expect(await handleSystemCommand('status', home)).toMatchObject({ openGoals: 0 });
});

test('system command rejects unknown commands', async () => {
  await expect(handleSystemCommand('invalid-action', await initHome())).rejects.toThrow(
    'Unknown command: invalid-action',
  );
});
