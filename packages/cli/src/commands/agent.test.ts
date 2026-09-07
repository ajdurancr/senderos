import { expect, test } from 'bun:test';
import { handleAgent } from './agent';
import { initHome } from '../../../core/src/test-support/runtime';

test('agent command lists seeded agents and shows one by id', async () => {
  const home = await initHome();
  const agents = await handleAgent('list', [], home) as any[];
  expect(agents.length).toBeGreaterThan(0);
  expect(
    (await handleAgent('show', ['agent', 'show', agents[0].id], home) as any).id,
  ).toBe(agents[0].id);
});
