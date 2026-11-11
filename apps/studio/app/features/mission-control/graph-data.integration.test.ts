import { afterAll, expect, test } from 'vitest';
import { mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(process.env.SENDEROS_TEST_RUNTIME_ROOT ?? resolve(import.meta.dirname, '../../../../../.tmp/test-runtime'), `graph-data-${crypto.randomUUID()}`);
mkdirSync(root, { recursive: true });
process.env.SENDEROS_DATABASE_URL = `file:${resolve(root, 'graphs.db')}`;
afterAll(() => rmSync(root, { recursive: true, force: true }));

test('HTTP graph data retains pinned published definitions and management drafts without hydrating unused history', async () => {
  const { missionControlData } = await import('./server');
  const { createSenderos, registerExecutionContext, createGoal, draftSendero, publishSendero, getSenderoGraph } = await import('@senderos/core');
  await missionControlData();
  await registerExecutionContext({ id: 'graph-data', name: 'Graph data fixture' });
  const core = createSenderos({ executionContextId: 'graph-data' });
  const project = await core.commands.projects.create({ name: 'Graph data project' });
  const original = (await getSenderoGraph('software-delivery'))!;
  await createGoal({ projectId: project.id, title: 'Pinned older definition', senderoVersionId: original.version.id });
  for (let i = 0; i < 5; i++) { await draftSendero(original.sendero.id); await publishSendero(original.sendero.id); }
  const draft = (await draftSendero(original.sendero.id))!;
  const activity = await missionControlData(new Request('http://studio.local/events'));
  expect(activity.historyGraphs.map(graph => graph.version.id)).toEqual([original.version.id]);
  expect(activity.draftGraphs).toEqual([]);
  expect(activity.senderoGraphs.find(graph => graph.sendero.id === original.sendero.id)?.version.version).toBe(6);
  expect(activity.historyGraphs[0]).toMatchObject({ version: original.version, nodes: original.nodes, edges: original.edges, revision: original.revision });
  const management = await missionControlData(new Request(`http://studio.local/senderos/${original.sendero.id}`));
  expect(management.draftGraphs.map(graph => graph.version.id)).toContain(draft.version.id);
  expect(management.historyGraphs[0]).toMatchObject({ version: original.version, nodes: original.nodes, edges: original.edges, revision: original.revision });
  const complete = await missionControlData();
  expect(complete.historyGraphs.filter(graph => graph.sendero.id === original.sendero.id)).toHaveLength(6);
  expect(complete.draftGraphs.map(graph => graph.version.id)).toContain(draft.version.id);
});
