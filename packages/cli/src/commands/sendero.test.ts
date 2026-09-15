import { expect, test } from 'bun:test';
import type { SenderoGraph, SenderoNodeRecord } from '@senderos/core';

import { initHome } from '../../../core/src/test-support/runtime';
import { handleSendero } from './sendero';

test('sendero CLI exposes intent-level graph actions', async () => {
  const home = await initHome();
  expect(await handleSendero('list', [], {}, home)).toHaveLength(5);
  expect(await handleSendero('version', ['sendero', 'version', 'list'], {}, home)).toHaveLength(5);

  const added = (await handleSendero(
    'agent',
    ['sendero', 'agent', 'add', 'software-delivery', 'incident-responder'],
    { label: 'Respond', from: 'mutation-tester' },
    home,
  )) as { agent: SenderoNodeRecord };
  expect(added.agent).toMatchObject({ label: 'Respond' });

  await expect(
    handleSendero(
      'connect',
      ['sendero', 'connect', 'software-delivery'],
      { from: 'tdd-craftsman', to: 'incident-responder' },
      home,
    ),
  ).resolves.toMatchObject({ sourceNodeId: expect.any(String) });

  await expect(
    handleSendero(
      'disconnect',
      ['sendero', 'disconnect', 'software-delivery'],
      { from: 'tdd-craftsman', to: 'incident-responder' },
      home,
    ),
  ).resolves.toMatchObject({ targetNodeId: added.agent.id });

  const removed = await handleSendero(
    'agent',
    ['sendero', 'agent', 'remove', 'software-delivery', 'incident-responder'],
    {},
    home,
  );
  expect(removed).toMatchObject({ removedConnections: 2 });

  const graph = (await handleSendero(
    'show',
    ['sendero', 'show', 'software-delivery'],
    {},
    home,
  )) as SenderoGraph;
  expect(graph.nodes.some((node) => node.agentId === added.agent.agentId)).toBe(false);
});
