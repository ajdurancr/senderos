import { expect, test } from 'bun:test';
import { initHome } from '../test-support/runtime';
import { draftSendero, editableGraph, publishSendero, setCompletionPolicy } from './versions';
import { updateAgent } from '../commands/agents/create';
import { replaceSenderoDraft } from '../commands/senderos/create';
import { updateSenderoNode } from '../internal/senderos/update-node';
import { updateSenderoEdge } from '../internal/senderos/update-edge';
test('draft creation is repeatable and publication validates completion policies', async () => {
  const home = await initHome();
  const first = await draftSendero('software-delivery', home);
  expect((await draftSendero('software-delivery', home))?.version.id).toBe(first?.version.id);
  expect((await editableGraph('software-delivery', home)).version.status).toBe('draft');
  await setCompletionPolicy({ senderoId: 'software-delivery', agent: 'judge', requireReview: true, evidenceKinds: ['ci'] }, home);
  expect((await publishSendero('software-delivery', home))?.version.status).toBe('published');
  await expect(publishSendero('software-delivery', home)).rejects.toMatchObject({ code: 'IMMUTABLE_VERSION' });
});

test('reviewed publication fences successor versions, same-draft edits, and changed agent definitions', async () => {
  const home = await initHome();
  const first = (await draftSendero('software-delivery', home))!;
  expect(first.revision).toMatch(/^[a-f0-9]{64}$/);
  expect((await editableGraph('software-delivery', home)).revision).toBe(first.revision);
  await setCompletionPolicy({ senderoId: 'software-delivery', agent: 'judge', requireReview: true, evidenceKinds: ['ci'] }, home);
  await expect(publishSendero('software-delivery', home, first.version.id, first.revision)).rejects.toMatchObject({ code: 'STALE_DRAFT' });
  const changed = await editableGraph('software-delivery', home);
  expect(changed.version.status).toBe('draft');
  await updateAgent({ id: changed.nodes.find(node => node.kind === 'agent')!.agentId!, instructions: 'Updated after review', home });
  await expect(publishSendero('software-delivery', home, changed.version.id, changed.revision)).rejects.toMatchObject({ code: 'STALE_DRAFT' });
  const reviewed = await editableGraph('software-delivery', home);
  const published = (await publishSendero('software-delivery', home, reviewed.version.id, reviewed.revision))!;
  expect(published.version.status).toBe('published');
  await draftSendero('software-delivery', home);
  await expect(publishSendero('software-delivery', home, reviewed.version.id, reviewed.revision)).rejects.toMatchObject({ code: 'STALE_VERSION' });
  expect((await editableGraph('software-delivery', home)).version.status).toBe('draft');
});

test('whole-graph saves reject stale content without overwriting a newer draft', async () => {
  const home = await initHome();
  const first = (await draftSendero('software-delivery', home))!;
  const input = { home, senderoId: first.sendero.id, expectedVersionId: first.version.id, expectedRevision: first.revision,
    nodes: first.nodes.map(node => ({ ...node, key: node.id })), edges: first.edges.map(edge => ({ ...edge, key: edge.id })), maxActivations: 42 };
  const saved = await replaceSenderoDraft(input);
  expect(saved.version.maxActivations).toBe(42);
  expect(saved.revision).not.toBe(first.revision);
  await expect(replaceSenderoDraft({ ...input, maxActivations: 99 })).rejects.toMatchObject({ code: 'STALE_DRAFT' });
  expect((await editableGraph(first.sendero.id, home)).version.maxActivations).toBe(42);
});

test('individual inspector edits fence changed draft content inside their transaction', async () => {
  const home = await initHome();
  const graph = (await draftSendero('software-delivery', home))!;
  const node = graph.nodes[0]!, edge = graph.edges[0]!;
  await updateSenderoNode({ home, id: node.id, label: 'Reviewed change', expectedRevision: graph.revision });
  await expect(updateSenderoNode({ home, id: node.id, label: 'Stale label', expectedRevision: graph.revision })).rejects.toMatchObject({ code: 'STALE_DRAFT' });
  await expect(updateSenderoEdge({ home, id: edge.id, completion: { requireReview: true }, expectedRevision: graph.revision })).rejects.toMatchObject({ code: 'STALE_DRAFT' });
  const fresh = await editableGraph(graph.sendero.id, home);
  expect(await updateSenderoEdge({ home, id: edge.id, name: 'Reviewed edge', expectedRevision: fresh.revision })).toMatchObject({ name: 'Reviewed edge' });
});
