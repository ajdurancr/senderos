import { draftSendero } from "../../../lifecycle/versions";
import { expect, test } from "bun:test";
import { initHome } from "../../../test-support/runtime";
import { addAgentToSendero } from "./add";
import { removeAgentFromSendero } from "./remove";

test("removes an agent and reconnects the surrounding Sendero", async () => {
  const home = await initHome();
  await draftSendero("software-delivery", home);
  await addAgentToSendero({
    home,
    senderoId: "software-delivery",
    agentId: "incident-responder",
    from: "mutation-tester",
    to: "judge",
  });
  await expect(
    removeAgentFromSendero({
      home,
      senderoId: "software-delivery",
      agentId: "incident-responder",
    }),
  ).resolves.toMatchObject({
    removedConnections: 2,
    connections: [{ sourceNodeId: expect.stringMatching(/^sendero-/), targetNodeId: expect.stringMatching(/^sendero-/) }],
  });
});

test('removing an intermediate agent keeps its predecessor execution policy', async () => {
  const { getSenderoGraph } = await import('../get-graph');
  const { getAgentBySlug } = await import('../../agents/get-by-slug');
  const { updateSenderoEdge } = await import('../../../internal/senderos/update-edge');
  const home = await initHome();
  const draft = (await draftSendero('software-delivery', home))!;
  const agent = (await getAgentBySlug('mutation-tester', home))!;
  const source = draft.nodes.find(node => node.agentId === agent.id)!;
  const edge = draft.edges.find(candidate => candidate.sourceNodeId === source.id)!;
  await updateSenderoEdge({ home, id: edge.id, transitionObjective: 'Keep the predecessor goal.', completion: { evidenceKinds: ['test'] } });
  await addAgentToSendero({ home, senderoId: 'software-delivery', agentId: 'incident-responder', from: 'mutation-tester', to: 'judge', executionObjective: 'Unrelated inserted goal.', completion: { requireReview: true } });
  const removed = await removeAgentFromSendero({ home, senderoId: 'software-delivery', agentId: 'incident-responder' });
  expect(removed.connections[0]).toMatchObject({ transitionObjective: 'Keep the predecessor goal.', conditionJson: '{"completion":{"evidenceKinds":["test"]}}' });
  const graph = (await getSenderoGraph('software-delivery', draft.version.version, home))!;
  expect(graph.nodes.find(node => node.id === source.id)).toMatchObject({ executionObjective: 'Keep the predecessor goal.', completionJson: '{"evidenceKinds":["test"]}' });
});

test('conditional routing cannot be silently discarded during automatic node removal', async () => {
  const { updateSenderoEdge } = await import('../../../internal/senderos/update-edge');
  const { getSenderoGraph } = await import('../get-graph');
  const home = await initHome();
  await draftSendero('software-delivery', home);
  const added = await addAgentToSendero({ home, senderoId: 'software-delivery', agentId: 'incident-responder', from: 'mutation-tester', to: 'judge' });
  await updateSenderoEdge({ home, id: added.connections[1]!.id, condition: { outcome: 'accepted' } });
  await expect(removeAgentFromSendero({ home, senderoId: 'software-delivery', agentId: 'incident-responder' })).rejects.toThrow('explicit replacement');
  expect((await getSenderoGraph('software-delivery', 2, home))?.nodes.some(node => node.id === added.agent.id)).toBe(true);
});
