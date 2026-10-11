import { draftSendero } from "../../../lifecycle/versions";
import { expect, test } from "bun:test";
import { initHome } from "../../../test-support/runtime";
import { addAgentToSendero } from "./add";

test("requires a connection point when adding to a populated Sendero", async () => {
  const home = await initHome();
  await draftSendero("software-delivery", home);
  await expect(
    addAgentToSendero({
      home,
      senderoId: "software-delivery",
      agentId: "incident-responder",
    }),
  ).rejects.toThrow("requires --from, --to, or both");
});

test('inserting an agent preserves the original source objective and completion gates', async () => {
  const { updateSenderoEdge } = await import('../../../internal/senderos/update-edge');
  const { getSenderoGraph } = await import('../get-graph');
  const home = await initHome();
  const draft = (await draftSendero('software-delivery', home))!;
  // Resolve via the persisted agent so template display labels do not affect the assertion.
  const { getAgentBySlug } = await import('../../agents/get-by-slug');
  const agent = (await getAgentBySlug('mutation-tester', home))!;
  const sourceNode = draft.nodes.find(node => node.agentId === agent.id)!;
  const before = draft.edges.find(edge => edge.sourceNodeId === sourceNode.id)!;
  await updateSenderoEdge({ home, id: before.id, transitionObjective: 'Find surviving mutations.', completion: { requireReview: true, evidenceKinds: ['test'] }, condition: { outcome: 'accepted' } });
  const added = await addAgentToSendero({ home, senderoId: 'software-delivery', agentId: 'incident-responder', from: 'mutation-tester', to: 'judge' });
  expect(added.connections[0]).toMatchObject({ transitionObjective: 'Find surviving mutations.', conditionJson: '{"outcome":"accepted","completion":{"requireReview":true,"evidenceKinds":["test"]}}' });
  const after = (await getSenderoGraph('software-delivery', draft.version.version, home))!;
  expect(after.nodes.find(node => node.id === sourceNode.id)).toMatchObject({ executionObjective: 'Find surviving mutations.', completionJson: '{"requireReview":true,"evidenceKinds":["test"]}' });
  expect(added.agent.completionJson).toBe('{}');
});
