import { expect, test } from 'bun:test';
import { handleAgent } from './agent';
import { getAgentBySlug } from '@senderos/core';
import { initHome } from '../../../core/src/test-support/runtime';

test('agent command lists seeded agents and shows one by id', async () => {
  const home = await initHome();
  const agent = (await getAgentBySlug('spec-partner', home))!;
  expect(await handleAgent('list', [], home)).toEqual(
    expect.arrayContaining([expect.objectContaining({ id: agent.id })]),
  );
  expect(await handleAgent('show', ['agent', 'show', agent.id], home)).toMatchObject({ id: agent.id });
});

test('agent command rejects unknown actions', async () => {
  await expect(handleAgent('delete', [], await initHome())).rejects.toThrow(
    'Unknown agent action',
  );
});

test('agent CLI creates and edits custom instructions', async () => {
  const home = await initHome();
  const created = await handleAgent('create', [], home, { slug: 'custom', name: 'Custom', instructions: 'Analyze an objective.' });
  expect(created).toMatchObject({ slug: 'custom', definitionBody: 'Analyze an objective.', kind: 'custom' });
  expect(await handleAgent('update', ['agent', 'update', 'custom'], home, { instructions: 'Analyze cited sources.', status: 'disabled' })).toMatchObject({ definitionBody: 'Analyze cited sources.', status: 'disabled' });
  expect(await handleAgent('show', ['agent', 'show', 'custom'], home)).toMatchObject({ slug: 'custom' });
});

test('agent CLI imports JSON and reads instruction files', async () => {
  const { writeFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const home = await initHome();
  const instructionsFile = join(home, 'instructions.md');
  const jsonFile = join(home, 'agent.json');
  writeFileSync(instructionsFile, 'Gather primary sources.');
  expect(await handleAgent('create', [], home, { slug: 'research', name: 'Research', 'instructions-file': instructionsFile })).toMatchObject({ definitionBody: 'Gather primary sources.' });
  writeFileSync(jsonFile, JSON.stringify({ slug: 'research', name: 'Research', definitionBody: 'Evaluate sources.' }));
  expect(await handleAgent('import', [], home, { file: jsonFile })).toMatchObject({ definitionBody: 'Evaluate sources.' });
  await expect(handleAgent('update', ['agent', 'update', 'research'], home, { instructions: 'Hi', 'instructions-file': instructionsFile })).rejects.toThrow('not both');
  writeFileSync(jsonFile, '[]');
  await expect(handleAgent('import', [], home, { file: jsonFile })).rejects.toThrow('JSON object');
});
