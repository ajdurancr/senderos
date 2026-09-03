import { expect, test } from 'bun:test';
import { handleTransition } from './transition';
import { getAgentBySlug } from '@senderos/senderos';
import { initHome } from '../../../senderos/tests/helpers/runtime';

test('transition command creates and retrieves a handoff', () => {
  const home = initHome();
  const agent = getAgentBySlug('spec-partner', home)!;
  const transition = (handleTransition as any)(
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
    (handleTransition as any)(
      'show',
      ['transition', 'show', transition.id],
      {},
      home,
    ).id,
  ).toBe(transition.id);
  expect(
    (handleTransition as any)('list', [], { 'agent-id': agent.id }, home)
      .length,
  ).toBeGreaterThan(0);
});
