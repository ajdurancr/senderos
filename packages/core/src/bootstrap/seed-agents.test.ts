import { expect, test } from 'bun:test';
import { builtInAgentSeedDir, seedBuiltInAgents } from './seed-agents';
import { initHome } from '../test-support/runtime';

test('built-in agent definitions are colocated with the bootstrap module', async () => {
  expect(builtInAgentSeedDir()).toEndWith('/bootstrap/agents');
  const home = await initHome();
  await expect(seedBuiltInAgents(home)).resolves.toEqual(
    expect.arrayContaining([
      expect.objectContaining({ slug: 'spec-partner' }),
    ]),
  );
});

test('demo wait agents hard-code their duration by Sendero position', async () => {
  const seeded = await seedBuiltInAgents(await initHome());
  for (const [index, word] of ['one', 'two', 'three', 'four', 'five'].entries()) {
    const minutes = index + 1;
    const agent = seeded.find((item) => item.slug === `wait-${word}-minute${minutes === 1 ? '' : 's'}`);
    expect(agent?.definitionBody).toContain(`Wait for exactly ${minutes} minute${minutes === 1 ? '' : 's'}`);
    expect(JSON.parse(agent!.defaultMetaJson)).toMatchObject({ demo: true, waitMinutes: minutes });
  }
});

test('reinitializing a runtime preserves edited and renamed bundled agents', async () => {
  const { updateAgent } = await import('../commands/agents/create');
  const { getAgent } = await import('../commands/agents/get');
  const { getAgentBySlug } = await import('../commands/agents/get-by-slug');
  const { listAgents } = await import('../commands/agents/list');
  const { initializeRuntime, loadConfig } = await import('../shared/config');
  const home = await initHome();
  const updated = await updateAgent({ home, id: 'spec-partner', slug: 'my-research-partner', name: 'Research partner', instructions: 'Use the instructions I authored.', status: 'disabled', defaultGoal: 'Prepare a report.', defaultMeta: { requiredCapabilities: ['browser'] } });
  await initializeRuntime(home, loadConfig(home));
  expect(await getAgent(updated.id, home)).toEqual(updated);
  expect(await getAgentBySlug('spec-partner', home)).toBeNull();
  expect(await listAgents(home)).toHaveLength(14);
});

test('explicit definition directories retain intentional upsert semantics', async () => {
  const { writeFileSync, mkdirSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { updateAgent } = await import('../commands/agents/create');
  const { getAgentBySlug } = await import('../commands/agents/get-by-slug');
  const home = await initHome();
  const old = await updateAgent({ home, id: 'spec-partner', instructions: 'Locally edited.', status: 'disabled' });
  const definitionsDir = join(home, 'custom-definitions');
  mkdirSync(definitionsDir);
  writeFileSync(join(definitionsDir, 'spec-partner.json'), JSON.stringify({ id: 'ignored-new-id', slug: 'spec-partner', name: 'Imported partner', definitionBody: 'Explicitly imported instructions.', status: 'active' }));
  await seedBuiltInAgents(home, { definitionsDir });
  expect(await getAgentBySlug('spec-partner', home)).toMatchObject({ id: old.id, name: 'Imported partner', definitionBody: 'Explicitly imported instructions.', status: 'active' });
});
