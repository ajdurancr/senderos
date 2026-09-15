import { expect, test } from 'bun:test';
import type { SenderoGraph, SenderoNodeRecord } from '@senderos/core';

import { initHome } from '../../../core/src/test-support/runtime';
import { handleSendero } from './sendero';

test('sendero CLI exposes intent-level graph actions', async () => {
  const home = await initHome();
  expect(await handleSendero('list', [], {}, home)).toHaveLength(4);
  expect(await handleSendero('version', ['sendero', 'version', 'list'], {}, home)).toHaveLength(4);

  const added = (await handleSendero(
    'agent',
    ['sendero', 'agent', 'add', 'software-delivery', 'incident-responder'],
    { label: 'Respond' },
    home,
  )) as SenderoNodeRecord;
  expect(added).toMatchObject({ label: 'Respond' });

  await expect(
    handleSendero(
      'connect',
      ['sendero', 'connect', 'software-delivery'],
      { from: 'mutation-tester', to: 'incident-responder', name: 'escalate', objective: 'Respond to the discovered issue.' },
      home,
    ),
  ).resolves.toMatchObject({ name: 'escalate' });

  await expect(
    handleSendero(
      'disconnect',
      ['sendero', 'disconnect', 'software-delivery'],
      { from: 'mutation-tester', to: 'incident-responder' },
      home,
    ),
  ).resolves.toMatchObject({ name: 'escalate' });

  const removed = await handleSendero(
    'agent',
    ['sendero', 'agent', 'remove', 'software-delivery', 'incident-responder'],
    {},
    home,
  );
  expect(removed).toMatchObject({ removedConnections: 0 });

  const graph = (await handleSendero(
    'show',
    ['sendero', 'show', 'software-delivery'],
    {},
    home,
  )) as SenderoGraph;
  expect(graph.nodes.some((node) => node.agentId === added.agentId)).toBe(false);
});
