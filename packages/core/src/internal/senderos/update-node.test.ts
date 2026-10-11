import { draftSendero } from "../../lifecycle/versions";
import { expect, test } from "bun:test";
import { getSenderoGraph } from "../../commands/senderos";
import { initHome } from "../../test-support/runtime";
import { updateSenderoNode } from "./update-node";

test("updates Sendero node configuration", async () => {
  const home = await initHome();
  const node = (await draftSendero("software-delivery", home))!.nodes[0]!;
  await expect(
    updateSenderoNode({ home, id: node.id, label: "Start here" }),
  ).resolves.toMatchObject({ label: "Start here" });
});

test('authors objective, policies, capabilities, and explicit join pairing on draft nodes', async () => {
  const home = await initHome();
  const draft = (await draftSendero('software-delivery', home))!;
  const node = draft.nodes.find(candidate => candidate.kind === 'agent')!;
  const fork = draft.nodes.find(candidate => candidate.kind === 'start')!;
  expect(await updateSenderoNode({ home, id: node.id, executionObjective: 'Research the question.', completion: { requireReview: true }, requirements: ['browser', 'browser'], joinForkNodeId: fork.id, positionX: 120, positionY: 90 })).toMatchObject({ executionObjective: 'Research the question.', completionJson: '{"requireReview":true}', requirementsJson: '["browser"]', joinForkNodeId: fork.id, positionX: 120, positionY: 90 });
  expect(await updateSenderoNode({ home, id: node.id, joinForkNodeId: null })).toMatchObject({ joinForkNodeId: null });
  await expect(updateSenderoNode({ home, id: node.id, joinForkNodeId: node.id })).rejects.toThrow('another node');
  await expect(updateSenderoNode({ home, id: node.id, joinForkNodeId: 'missing' })).rejects.toThrow('another node');
  await expect(updateSenderoNode({ home, id: node.id, label: ' ' })).rejects.toThrow('label');
  await expect(updateSenderoNode({ home, id: node.id, positionX: Number.NaN })).rejects.toThrow('finite');
  await expect(updateSenderoNode({ home, id: fork.id, executionObjective: 'No boundary executions' })).rejects.toThrow('agent nodes');
  await expect(updateSenderoNode({ home, id: 'missing' })).rejects.toThrow('not found');
});

test('editing one legacy node policy preserves the other execution fields', async () => {
  const { updateSenderoEdge } = await import('./update-edge');
  const home = await initHome();
  const draft = (await draftSendero('software-delivery', home))!;
  const node = draft.nodes.find(candidate => candidate.kind === 'agent')!;
  const edge = draft.edges.find(candidate => candidate.sourceNodeId === node.id)!;
  await updateSenderoEdge({ home, id: edge.id, completion: { evidenceKinds: ['artifact'] } });
  expect(await updateSenderoNode({ home, id: node.id, executionObjective: 'Refine the objective.' })).toMatchObject({ executionObjective: 'Refine the objective.', completionJson: '{"evidenceKinds":["artifact"]}' });
  const other = draft.nodes.filter(candidate => candidate.kind === 'agent')[1]!;
  const otherEdge = draft.edges.find(candidate => candidate.sourceNodeId === other.id)!;
  expect(await updateSenderoNode({ home, id: other.id, completion: { requireReview: true } })).toMatchObject({ executionObjective: otherEdge.transitionObjective, completionJson: '{"requireReview":true}' });
});
