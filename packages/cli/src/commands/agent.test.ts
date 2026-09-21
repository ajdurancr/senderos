import { expect, test } from 'bun:test';
import { handleAgent } from './agent';
import { getAgentBySlug } from '@senderos/core';
import { initHome } from '../../../core/src/test-support/runtime';

test('agent command lists seeded agents and shows one by id', async () => {
  const home = await initHome();
  const agent = (await getAgentBySlug('spec-partner', home))!;
  expect(await handleAgent('list', [], home)).toEqual(
    expect.arrayContaining([expect.objectContaining({ id: agent.id })]),
  );
  expect(await handleAgent('show', ['agent', 'show', agent.id], home)).toMatchObject({ id: agent.id });
});

test('agent command rejects unknown actions', async () => {
  await expect(handleAgent('delete', [], await initHome())).rejects.toThrow(
    'Unknown agent action',
  );
});
