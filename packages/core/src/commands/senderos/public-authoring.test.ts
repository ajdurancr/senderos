import { expect, test } from 'bun:test';
import { createSenderos } from '../../index';
import { initHome } from '../../test-support/runtime';

test('the public facade authors custom agents and Senderos with pinned instructions', async () => {
  const home = await initHome();
  const api = createSenderos({ home });
  const agent = await api.commands.agents.create({ slug: 'facade-researcher', name: 'Researcher', instructions: 'Gather evidence.' });
  expect(await api.commands.agents.update({ id: agent.id, instructions: 'Gather and cite evidence.' })).toMatchObject({ id: agent.id, definitionBody: 'Gather and cite evidence.' });
  const blank = await api.commands.senderos.create({ slug: 'facade-blank', name: 'Blank' });
  expect(blank.version.status).toBe('draft');
  const graph = await api.commands.senderos.import({ slug: 'facade-research', name: 'Research', nodes: [
    { key: 'start', kind: 'start', label: 'Start' },
    { key: 'research', kind: 'agent', label: 'Research', agentId: agent.id, executionObjective: 'Prepare a sourced report.' },
    { key: 'end', kind: 'end', label: 'End' },
  ], edges: [{ source: 'start', target: 'research' }, { source: 'research', target: 'end' }] });
  const updated = await api.commands.senderos.replaceDraft({ senderoId: graph.sendero.id, expectedVersionId: graph.version.id, nodes: graph.nodes, edges: graph.edges, maxActivations: 40 });
  const node = updated.nodes.find(candidate => candidate.kind === 'agent')!;
  await api.missionControl.senderos.updateNode({ id: node.id, executionObjective: 'Compare cited sources.', completion: { evidenceKinds: ['artifact'] }, requirements: ['browser'] });
  const published = (await api.commands.senderos.publish(graph.sendero.id))!;
  expect(published.nodes.find(candidate => candidate.id === node.id)?.agentSnapshotJson).toContain('Gather and cite evidence.');
  expect(await api.commands.agents.upsert({ slug: agent.slug, name: agent.name, instructions: 'Instructions for future publications.' })).toMatchObject({ id: agent.id });
  expect((await api.commands.senderos.get(graph.sendero.id))?.nodes.find(candidate => candidate.id === node.id)?.agentSnapshotJson).toContain('Gather and cite evidence.');
  const project = await api.commands.projects.create({ name: 'Research workspace' });
  const goal = await api.commands.goals.create({ projectId: project.id, title: 'Research options', kind: 'research', senderoVersionId: published.version.id });
  await api.commands.goals.activate(goal.id);
  expect(await api.commands.goals.setActivationBudget(goal.id, 60)).toMatchObject({ goalId: goal.id });
});
