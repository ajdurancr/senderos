import { expect, test } from 'bun:test';
import { handleAgent } from './agent';
import { initHome } from '../../../tests/helpers/runtime';

test('agent command lists seeded agents and shows one by id', () => {
  const home = initHome();
  const agents = handleAgent('list', [], home) as any[];
  expect(agents.length).toBeGreaterThan(0);
  expect(
    (handleAgent('show', ['agent', 'show', agents[0].id], home) as any).id,
  ).toBe(agents[0].id);
});
