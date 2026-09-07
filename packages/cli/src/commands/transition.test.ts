import { expect, test } from 'bun:test';
import { handleTransition } from './transition';
import { getAgentBySlug } from '@senderos/core';
import { initHome } from '../../../core/src/test-support/runtime';

test('transition command creates and retrieves a handoff', async () => {
  const home = await initHome();
  const agent = (await getAgentBySlug('spec-partner', home))!;
  const transition = await (handleTransition as any)(
    'create',
    [],
    {
      'source-agent-id': agent.id,
      name: 'CLI handoff',
      objective: 'Review the result.',
    },
    home,
  );
  expect(
    (await (handleTransition as any)(
      'show',
      ['transition', 'show', transition.id],
      {},
      home,
    )).id,
  ).toBe(transition.id);
  expect(
    (await (handleTransition as any)('list', [], { 'agent-id': agent.id }, home))
      .length,
  ).toBeGreaterThan(0);
});
