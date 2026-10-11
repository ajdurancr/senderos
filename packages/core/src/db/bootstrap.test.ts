import { expect, test } from "bun:test";

import { listAgents } from "../commands";
import { listSenderoGraphs } from "../mission-control/senderos";
import { tempHome } from "../test-support/runtime";
import { prepareSharedDatabase } from "./bootstrap";

test("prepareSharedDatabase migrates and seeds without a runtime config", async () => {
  const home = tempHome();
  process.env.SENDEROS_DATABASE_URL = `file:${home}/shared.db`;

  await expect(prepareSharedDatabase()).resolves.toBeUndefined();
  await expect(listAgents()).resolves.toHaveLength(14);
  await expect(listSenderoGraphs()).resolves.toHaveLength(5);
  await expect(prepareSharedDatabase()).resolves.toBeUndefined();
  await expect(listAgents()).resolves.toHaveLength(14);
  await expect(listSenderoGraphs()).resolves.toHaveLength(5);
});

test('preparing an existing shared database preserves authored agents and published topology', async () => {
  const { updateAgent } = await import('../commands/agents/create');
  const { getAgentBySlug } = await import('../commands/agents/get-by-slug');
  const { getSenderoGraph } = await import('../commands/senderos/get-graph');
  const { draftSendero, publishSendero } = await import('../lifecycle/versions');
  const { updateSenderoNode } = await import('../internal/senderos/update-node');
  const home = tempHome();
  process.env.SENDEROS_DATABASE_URL = `file:${home}/authored-shared.db`;
  await prepareSharedDatabase();
  const edited = await updateAgent({ id: 'spec-partner', instructions: 'Custom initial instructions.' });
  const draft = (await draftSendero('software-delivery'))!;
  const node = draft.nodes.find(candidate => candidate.agentId === edited.id)!;
  await updateSenderoNode({ id: node.id, label: 'User-authored label', executionObjective: 'User-authored objective.', completion: { requireReview: true } });
  const publication = await publishSendero(draft.sendero.id);
  const current = await updateAgent({ id: 'spec-partner', instructions: 'Later instructions.', status: 'disabled' });
  await prepareSharedDatabase();
  expect(await getAgentBySlug('spec-partner')).toEqual(current);
  expect(await getSenderoGraph(draft.sendero.id)).toEqual(publication);
  expect(publication?.nodes.find(candidate => candidate.id === node.id)?.agentSnapshotJson).toContain('Custom initial instructions.');
});
