import { expect, test } from 'bun:test';
import { builtInAgentSeedDir, seedBuiltInAgents } from './seed-agents';
import { initHome } from '../test-support/runtime';

test('built-in agent definitions are colocated with the bootstrap module', () => {
  expect(builtInAgentSeedDir()).toEndWith('/bootstrap/agents');
  const home = initHome();
  expect(seedBuiltInAgents(home)).not.toHaveLength(0);
});
