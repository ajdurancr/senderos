import { expect, test } from 'bun:test';

import { createSenderos } from './index';
import { initHome } from './test-support/runtime';

test('createSenderos scopes the public API to one Senderos home', async () => {
  const senderos = createSenderos({ home: await initHome() });
  expect(await senderos.commands.projects.list()).toEqual([]);
  expect((await senderos.missionControl.overview()).goals).toEqual([]);
  const [graph] = await senderos.missionControl.senderos.listGraphs();
  expect(await senderos.commands.senderos.list()).toHaveLength(5);
  expect(await senderos.commands.senderos.versions.list()).toHaveLength(5);
  expect((await senderos.commands.senderos.get(graph!.sendero.id))?.version.id).toBe(graph!.version.id);
  await senderos.missionControl.senderos.updateNodePosition({ id: graph!.nodes[0]!.id, positionX: 80, positionY: 90 });
  await senderos.missionControl.senderos.updateNode({ id: graph!.nodes[0]!.id, label: 'Start here' });
  await senderos.missionControl.senderos.updateEdge({ id: graph!.edges[0]!.id, name: 'begin here' });
  const added = await senderos.commands.senderos.agents.add({
    senderoId: graph!.sendero.id,
    agentId: 'incident-responder',
    from: 'mutation-tester',
  });
  await senderos.commands.senderos.connect({
    senderoId: graph!.sendero.id,
    from: 'tdd-craftsman',
    to: 'incident-responder',
  });
  await senderos.commands.senderos.disconnect({
    senderoId: graph!.sendero.id,
    from: 'tdd-craftsman',
    to: 'incident-responder',
  });
  expect(
    await senderos.commands.senderos.agents.remove({
      senderoId: graph!.sendero.id,
      agentId: added.agent.id,
    }),
  ).toMatchObject({ agent: { id: added.agent.id } });
});
