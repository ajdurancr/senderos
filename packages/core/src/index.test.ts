import { expect, test } from 'bun:test';

import { createSenderos } from './index';
import { initHome } from './test-support/runtime';

test('createSenderos scopes the public API to one Senderos home', async () => {
  const senderos = createSenderos({ home: await initHome() });
  expect(await senderos.commands.projects.list()).toEqual([]);
  expect((await senderos.missionControl.overview()).goals).toEqual([]);
  const [graph] = await senderos.missionControl.senderos.listGraphs();
  expect(await senderos.commands.senderos.list()).toHaveLength(4);
  expect(await senderos.commands.senderos.versions.list()).toHaveLength(4);
  expect((await senderos.commands.senderos.get(graph!.sendero.id))?.version.id).toBe(graph!.version.id);
  await senderos.missionControl.senderos.updateNodePosition({ id: graph!.nodes[0]!.id, positionX: 80, positionY: 90 });
  await senderos.commands.senderos.nodes.update({ id: graph!.nodes[0]!.id, label: 'Start here' });
  await senderos.commands.senderos.edges.update({ id: graph!.edges[0]!.id, name: 'begin here' });
});
