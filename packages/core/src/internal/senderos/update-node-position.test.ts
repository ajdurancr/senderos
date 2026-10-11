import { expect, test } from "bun:test";
import { getSenderoGraph } from "../../commands/senderos";
import { initHome } from "../../test-support/runtime";
import { updateSenderoLayout, updateSenderoNodePosition } from "./update-node-position";
import { createSenderos } from "../../index";

test("persists rounded canvas coordinates", async () => {
  const home = await initHome();
  const node = (await getSenderoGraph("software-delivery", 1, home))!.nodes[0]!;
  await expect(updateSenderoNodePosition({ home, id: node.id, positionX: 90.4, positionY: 70.8 }))
    .resolves.toMatchObject({ positionX: 90, positionY: 71 });
});

test('layout saves fence their exact published version and validate all coordinates before mutation', async () => {
  const home = await initHome();
  const graph = (await getSenderoGraph('software-delivery', 1, home))!;
  const node = graph.nodes[0]!;
  const input = { home, senderoId: graph.sendero.id, expectedVersionId: graph.version.id, expectedRevision: graph.revision!, positions: { [node.id]: { x: 120, y: 80 } } };
  await expect(updateSenderoLayout({ ...input, expectedVersionId: 'missing' })).rejects.toMatchObject({ code: 'STALE_VERSION' });
  await expect(updateSenderoLayout({ ...input, senderoId: 'security-hardening' })).rejects.toMatchObject({ code: 'STALE_VERSION' });
  await expect(updateSenderoLayout({ ...input, expectedRevision: 'stale' })).rejects.toMatchObject({ code: 'STALE_DRAFT' });
  await expect(updateSenderoLayout({ ...input, positions: [] as never })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  await expect(updateSenderoLayout({ ...input, positions: {} })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  await expect(updateSenderoLayout({ ...input, positions: { ...input.positions, missing: { x: 1, y: 2 } } })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  await expect(updateSenderoLayout({ ...input, positions: { [node.id]: { x: NaN, y: 2 } } })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  expect((await getSenderoGraph(graph.sendero.id, 1, home))!.revision).toBe(graph.revision);
  const { home: _, ...facadeInput } = input;
  const updated = (await createSenderos({ home }).missionControl.senderos.updateLayout(facadeInput))!;
  expect(updated.nodes.find(item => item.id === node.id)).toMatchObject({ positionX: 120, positionY: 80 });
  await expect(updateSenderoNodePosition({ home, id: node.id, positionX: 1, positionY: 2, expectedRevision: graph.revision })).rejects.toMatchObject({ code: 'STALE_DRAFT' });
  expect(await updateSenderoNodePosition({ home, id: node.id, positionX: 1, positionY: 2, expectedRevision: updated.revision })).toMatchObject({ positionX: 1, positionY: 2 });
  await expect(updateSenderoNodePosition({ home, id: 'missing', positionX: 1, positionY: 2 })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  await expect(updateSenderoNodePosition({ home, id: node.id, positionX: NaN, positionY: 2 })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
});
