import { expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { initHome } from '../test-support/runtime';
import { getSenderoGraph } from '../commands/senderos/get-graph';
import { openRuntimeDb, atomic } from '../db/client';
import { senderoEdges, agents } from '../db/schema';
import { route } from './route';
test('routing validates conditions and agent availability before any dispatch', async () => {
  const home = await initHome(); const graph = (await getSenderoGraph('software-delivery', undefined, home))!;
  expect(await route(graph.version.id, home)).toHaveLength(5);
  const edge = graph.edges[1]!;
  for (const conditionJson of ['{', '{"if":"success"}', '{"completion":{"evidenceKinds":["unknown"]}}']) {
    await expect(atomic(home, async () => {
      await openRuntimeDb(home).update(senderoEdges).set({ conditionJson }).where(eq(senderoEdges.id, edge.id));
      await route(graph.version.id, home);
    })).rejects.toThrow();
  }
  const agent = graph.nodes.find(n => n.agentId)!;
  await openRuntimeDb(home).update(agents).set({ status: 'disabled' }).where(eq(agents.id, agent.agentId!));
  await expect(route(graph.version.id, home)).rejects.toMatchObject({ code: 'AGENT_UNAVAILABLE' });
  expect(await route(graph.version.id, home, false)).toHaveLength(5);
});
