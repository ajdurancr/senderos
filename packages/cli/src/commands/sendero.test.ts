import { expect, test } from 'bun:test';
import type { SenderoGraph, SenderoNodeRecord } from '@senderos/core';

import { initHome } from '../../../core/src/test-support/runtime';
import { handleSendero } from './sendero';

test('sendero CLI exposes intent-level graph actions', async () => {
  const home = await initHome();
  expect(await handleSendero('list', [], {}, home)).toHaveLength(5);
  expect(await handleSendero('version', ['sendero', 'version', 'list'], {}, home)).toHaveLength(5);
  await handleSendero('draft', ['sendero', 'draft', 'software-delivery'], {}, home);
  await expect(handleSendero('policy', ['sendero', 'policy', 'software-delivery'], { agent: 'judge', 'require-review': true, 'evidence-kind': ['test', 'ci'] }, home))
    .resolves.toMatchObject({ conditionJson: expect.stringContaining('requireReview') });

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
  ).resolves.toMatchObject({ sourceNodeId: expect.stringMatching(/^sendero-/) });

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

test('sendero CLI validates every unsupported or malformed action', async () => {
  const home = await initHome();
  await expect(handleSendero('show', ['sendero', 'show', 'software-delivery'], { version: 'nope' }, home))
    .rejects.toThrow('Sendero version must be an integer');
  await expect(handleSendero('version', ['sendero', 'version', 'show'], {}, home))
    .rejects.toThrow('Unknown sendero version action');
  await expect(handleSendero('agent', ['sendero', 'agent', 'move', 'software-delivery', 'spec-partner'], {}, home))
    .rejects.toThrow('Unknown sendero agent action');
  await expect(handleSendero('connect', ['sendero', 'connect', 'software-delivery'], {}, home))
    .rejects.toThrow('Missing required option: --from');
  await expect(handleSendero('wat', [], {}, home)).rejects.toThrow('Unknown sendero action');
});

test('sendero CLI creates and imports custom drafts then atomically replaces topology', async () => {
  const { writeFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const home = await initHome();
  const created = await handleSendero('create', [], { slug: 'blank', name: 'Blank', 'max-activations': '20' }, home) as SenderoGraph;
  expect(created.version).toMatchObject({ status: 'draft', maxActivations: 20 });
  const file = join(home, 'graph.json');
  writeFileSync(file, JSON.stringify({ slug: 'custom', name: 'Custom', nodes: [
    { key: 'start', kind: 'start', label: 'Start' },
    { key: 'research', kind: 'agent', agentSlug: 'spec-partner', label: 'Research', executionObjective: 'Research options.' },
    { key: 'end', kind: 'end', label: 'End' },
  ], edges: [{ source: 'start', target: 'research' }, { source: 'research', target: 'end', condition: { outcome: 'accepted' } }] }));
  const imported = await handleSendero('import', [], { file }, home) as SenderoGraph;
  expect(imported.nodes.find(node => node.kind === 'agent')?.executionObjective).toBe('Research options.');
  const replaced = await handleSendero('replace', ['sendero', 'replace', 'blank'], { file, 'expected-version-id': created.version.id, 'expected-revision': created.revision! }, home) as SenderoGraph;
  expect(replaced.sendero.slug).toBe('blank');
  expect(replaced.nodes).toHaveLength(3);
  await expect(handleSendero('replace', ['sendero', 'replace', 'blank'], { file, 'expected-version-id': created.version.id, 'expected-revision': created.revision! }, home)).rejects.toMatchObject({ code: 'STALE_DRAFT' });
  await expect(handleSendero('publish', ['sendero', 'publish', 'blank'], { 'expected-version-id': replaced.version.id, 'expected-revision': created.revision! }, home)).rejects.toMatchObject({ code: 'STALE_DRAFT' });
  expect(await handleSendero('publish', ['sendero', 'publish', 'blank'], { 'expected-version-id': replaced.version.id, 'expected-revision': replaced.revision! }, home)).toMatchObject({ version: { status: 'published' } });
});
