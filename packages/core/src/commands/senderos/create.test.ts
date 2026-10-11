import { expect, test } from 'bun:test';
import { initHome } from '../../test-support/runtime';
import { createAgent } from '../agents/create';
import { draftSendero, publishSendero } from '../../lifecycle/versions';
import { getSenderoGraph } from './get-graph';
import { newSendero, importSendero, replaceSenderoDraft } from './create';

async function fixture() {
  const home = await initHome();
  await createAgent({ home, slug: 'researcher', name: 'Researcher', instructions: 'Use primary sources.' });
  const nodes = [
    { key: 'start', kind: 'start' as const, label: 'Start' },
    { key: 'research', kind: 'agent' as const, label: 'Research', agentSlug: 'researcher', executionObjective: 'Research the topic.', completion: { evidenceKinds: ['artifact'] }, requirements: ['browser'] },
    { key: 'end', kind: 'end' as const, label: 'End' },
  ];
  const edges = [{ key: 'entry', source: 'start', target: 'research' }, { key: 'done', source: 'research', target: 'end', condition: { outcome: 'accepted' } }];
  return { home, nodes, edges };
}

test('creates and imports arbitrary draft definitions with node-owned policies', async () => {
  const input = await fixture();
  const graph = await importSendero({ ...input, slug: 'research', name: 'Research', maxActivations: 25 });
  expect(graph.version).toMatchObject({ status: 'draft', maxActivations: 25 });
  expect(graph.nodes.find(node => node.kind === 'agent')).toMatchObject({ executionObjective: 'Research the topic.', completionJson: '{"evidenceKinds":["artifact"]}', requirementsJson: '["browser"]' });
  expect(graph.edges.find(edge => edge.conditionJson !== '{}')?.conditionJson).toBe('{"outcome":"accepted"}');
  const empty = await newSendero({ home: input.home, slug: 'empty', name: 'Empty' });
  expect(empty.nodes.map(node => node.kind)).toEqual(['start', 'end']);
  expect(empty.edges).toHaveLength(1);
});

test('atomically replaces topology, preserves IDs and policies, and fences publication', async () => {
  const input = await fixture();
  const graph = await newSendero({ ...input, slug: 'replaceable', name: 'Replaceable' });
  const replaced = await replaceSenderoDraft({ home: input.home, senderoId: graph.sendero.id, expectedVersionId: graph.version.id, nodes: graph.nodes.map(node => ({ ...node, key: node.id })), edges: graph.edges.map(edge => ({ ...edge, source: edge.sourceNodeId, target: edge.targetNodeId })), maxActivations: 30 });
  expect(replaced.nodes.map(node => node.id)).toEqual(graph.nodes.map(node => node.id));
  expect(replaced.edges.map(edge => edge.id)).toEqual(graph.edges.map(edge => edge.id));
  expect(replaced.version.maxActivations).toBe(30);
  await expect(replaceSenderoDraft({ home: input.home, senderoId: graph.sendero.id, expectedVersionId: 'stale', nodes: input.nodes, edges: [] })).rejects.toThrow('reload');
  await expect(replaceSenderoDraft({ home: input.home, senderoId: graph.sendero.id, expectedVersionId: graph.version.id, nodes: input.nodes, edges: [{ source: 'missing', target: 'end' }] })).rejects.toThrow('reference');
  expect((await getSenderoGraph(graph.sendero.id, 1, input.home))?.edges).toHaveLength(2);
  await publishSendero(graph.sendero.id, input.home);
  await expect(replaceSenderoDraft({ home: input.home, senderoId: graph.sendero.id, expectedVersionId: graph.version.id, nodes: input.nodes, edges: [] })).rejects.toThrow('draft');
});

test('imports explicit join pairing by local key and repeated references to an agent', async () => {
  const input = await fixture();
  const nodes = [...input.nodes.slice(0, 2), { key: 'review', kind: 'agent' as const, label: 'Review', agentSlug: 'researcher', executionObjective: 'Review.', joinForkNodeId: 'research' }, input.nodes[2]!];
  const graph = await newSendero({ ...input, nodes, slug: 'join', name: 'Join' });
  expect(graph.nodes.find(node => node.label === 'Review')?.joinForkNodeId).toBe(graph.nodes.find(node => node.label === 'Research')?.id);
});

test('rejects malformed or ambiguous definitions without partial persistence', async () => {
  const input = await fixture();
  for (const override of [
    { slug: 'Bad slug' }, { maxActivations: 0 }, { maxActivations: 10001 }, { maxActivations: 1.5 },
    { nodes: [input.nodes[0]!, input.nodes[0]!, input.nodes[2]!] },
    { edges: [{ source: 'research', target: 'missing' }] },
    { nodes: input.nodes.map(node => node.kind === 'agent' ? { ...node, agentSlug: 'missing' } : node) },
  ]) {
    await expect(newSendero({ ...input, slug: 'invalid', name: 'Invalid', ...override })).rejects.toThrow();
    expect(await getSenderoGraph('invalid', undefined, input.home)).toBeNull();
  }
  await newSendero({ ...input, slug: 'existing', name: 'Existing' });
  await expect(newSendero({ ...input, slug: 'existing', name: 'Existing' })).rejects.toThrow('already exists');
});

test('preserves a legacy source policy during full topology replacement', async () => {
  const home = await initHome();
  const draft = (await draftSendero('software-delivery', home))!;
  const node = draft.nodes.find(candidate => candidate.kind === 'agent')!;
  const edge = draft.edges.find(candidate => candidate.sourceNodeId === node.id)!;
  const replaced = await replaceSenderoDraft({ home, senderoId: draft.sendero.id, expectedVersionId: draft.version.id, nodes: draft.nodes.map(({ id, kind, label, agentId }) => ({ key: id, kind, label, agentId })), edges: draft.edges.map(item => ({ ...item, source: item.sourceNodeId, target: item.targetNodeId })) });
  expect(replaced.nodes.find(candidate => candidate.id === node.id)?.executionObjective).toBe(edge.transitionObjective);
});

test('raw legacy exports retain edge-owned gates when saved and allow explicit clearing', async () => {
  const { updateSenderoEdge } = await import('../../internal/senderos/update-edge');
  const home = await initHome();
  let draft = (await draftSendero('software-delivery', home))!;
  const node = draft.nodes.find(candidate => candidate.kind === 'agent')!;
  const edge = draft.edges.find(candidate => candidate.sourceNodeId === node.id)!;
  await updateSenderoEdge({ home, id: edge.id, completion: { requireReview: true, evidenceKinds: ['artifact'] } });
  draft = (await getSenderoGraph(draft.sendero.id, draft.version.version, home))!;
  const replaced = await replaceSenderoDraft({ home, senderoId: draft.sendero.id, expectedVersionId: draft.version.id, nodes: draft.nodes, edges: draft.edges });
  const promoted = replaced.nodes.find(candidate => candidate.id === node.id)!;
  expect(promoted.completionJson).toBe('{"requireReview":true,"evidenceKinds":["artifact"]}');
  const cleared = await replaceSenderoDraft({ home, senderoId: draft.sendero.id, expectedVersionId: draft.version.id, nodes: replaced.nodes.map(candidate => candidate.id === node.id ? { ...candidate, completion: {} } : candidate), edges: replaced.edges });
  expect(cleared.nodes.find(candidate => candidate.id === node.id)?.completionJson).toBe('{}');
});

test('an explicit node objective and policy resolve conflicting legacy edge definitions', async () => {
  const { openRuntimeDb } = await import('../../db/client');
  const { senderoEdges } = await import('../../db/schema');
  const home = await initHome();
  let draft = (await draftSendero('software-delivery', home))!;
  const node = draft.nodes.find(candidate => candidate.kind === 'agent')!;
  const edge = draft.edges.find(candidate => candidate.sourceNodeId === node.id)!;
  await openRuntimeDb(home).insert(senderoEdges).values({ ...edge, id: 'conflicting-edge', transitionObjective: 'Another legacy objective.' });
  draft = (await getSenderoGraph(draft.sendero.id, draft.version.version, home))!;
  await expect(replaceSenderoDraft({ home, senderoId: draft.sendero.id, expectedVersionId: draft.version.id, nodes: draft.nodes, edges: draft.edges })).rejects.toThrow('conflict');
  const resolved = await replaceSenderoDraft({ home, senderoId: draft.sendero.id, expectedVersionId: draft.version.id, nodes: draft.nodes.map(candidate => candidate.id === node.id ? { ...candidate, executionObjective: 'Resolved objective.', completion: { requireReview: true } } : candidate), edges: draft.edges });
  expect(resolved.nodes.find(candidate => candidate.id === node.id)).toMatchObject({ executionObjective: 'Resolved objective.', completionJson: '{"requireReview":true}' });
});

test('imports legacy edge-owned objectives and rejects ambiguous or malformed policies', async () => {
  const input = await fixture();
  const nodes = input.nodes.map(node => ({ key: node.key, kind: node.kind, label: node.label, agentSlug: node.agentSlug }));
  const edges = [{ source: 'start', target: 'research' }, { source: 'research', target: 'end', objective: 'Preserve imported objective.', condition: { completion: { evidenceKinds: ['artifact'] } } }];
  const graph = await importSendero({ ...input, nodes, edges, slug: 'legacy-import', name: 'Legacy' });
  expect(graph.nodes.find(node => node.kind === 'agent')).toMatchObject({ executionObjective: 'Preserve imported objective.', completionJson: '{"evidenceKinds":["artifact"]}' });
  await expect(importSendero({ ...input, nodes, edges: [...edges, { source: 'research', target: 'end', objective: 'Conflicting objective.' }], slug: 'ambiguous', name: 'Ambiguous' })).rejects.toThrow('conflict');
  for (const overrides of [
    { nodes: null }, { nodes: [null] }, { edges: [null] }, { nodes: [{ ...nodes[0], key: undefined }, nodes[1], nodes[2]] },
    { nodes: nodes.map(node => node.kind === 'agent' ? { ...node, kind: 'unknown' } : node) },
    { nodes: nodes.map(node => node.kind === 'agent' ? { ...node, label: '' } : node) },
    { nodes: nodes.map(node => node.kind === 'start' ? { ...node, agentSlug: 'researcher' } : node) },
    { nodes: nodes.map(node => node.kind === 'agent' ? { ...node, joinForkNodeId: 'missing' } : node) },
    { nodes: nodes.map(node => node.kind === 'agent' ? { ...node, positionX: Infinity } : node) },
    { nodes: nodes.map(node => node.kind === 'agent' ? { ...node, requirements: [''] } : node) },
    { edges: [{ source: 'start', target: 'research', status: 'unknown' }] },
    { edges: [{ key: 'same', source: 'start', target: 'research' }, { key: 'same', source: 'research', target: 'end' }] },
    { edges: [{ source: 'start', target: 'research', conditionJson: 'not-json' }] },
  ]) await expect(newSendero({ ...input, slug: 'invalid-boundary', name: 'Invalid', ...overrides } as never)).rejects.toThrow();
});
