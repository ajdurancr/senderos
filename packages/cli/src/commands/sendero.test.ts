import { expect, test } from 'bun:test';
import type { SenderoGraph } from '@senderos/core';

import { initHome } from '../../../core/src/test-support/runtime';
import { handleSendero } from './sendero';

test('sendero commands expose business operations without canvas layout mutations', async () => {
  const home = await initHome();
  const senderos = await handleSendero('list', [], {}, home);
  expect(senderos).toHaveLength(4);

  const graph = (await handleSendero(
    'show',
    ['sendero', 'show', 'software-delivery'],
    { version: '1' },
    home,
  )) as SenderoGraph | null;
  expect(graph?.version.version).toBe(1);

  const versions = await handleSendero('versions', [], {}, home);
  expect(versions).toHaveLength(4);

  await expect(
    handleSendero(
      'node',
      ['sendero', 'node', 'update', graph!.nodes[0]!.id],
      { label: 'Begin' },
      home,
    ),
  ).resolves.toMatchObject({ label: 'Begin' });

  await expect(
    handleSendero(
      'edge',
      ['sendero', 'edge', 'update', graph!.edges[0]!.id],
      { name: 'continue' },
      home,
    ),
  ).resolves.toMatchObject({ name: 'continue' });
});
