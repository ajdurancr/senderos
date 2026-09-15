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
