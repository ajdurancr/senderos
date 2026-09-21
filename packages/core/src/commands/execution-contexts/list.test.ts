import { expect, test } from 'bun:test';
import { initHome } from '../../test-support/runtime';
import { listExecutionContexts } from './list';

test('lists registered execution contexts', async () => {
  const home = await initHome();
  expect((await listExecutionContexts(home)).some((context) => context.id.startsWith('context-'))).toBe(true);
});
