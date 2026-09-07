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
