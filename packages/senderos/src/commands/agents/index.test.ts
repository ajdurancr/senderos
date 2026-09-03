import { expect, test } from 'bun:test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getAgentBySlug, listAgents } from '.';
import { seedBuiltInAgents } from '.';
import { createAgentTransition, listAgentTransitions } from '../transitions';
import { initHome, tempHome } from '../../../tests/helpers/runtime';

test('agent service seeds executors and supports explicit transitions', () => {
  const home = initHome();
  const agent = getAgentBySlug('spec-partner', home)!;
  const transition = createAgentTransition({
    home,
    sourceAgentId: agent.id,
    name: 'Implementation handoff',
    transitionObjective: 'Implement the approved goal.',
  });
  expect(listAgents(home).length).toBeGreaterThan(0);
  expect(
    listAgentTransitions(home).some((item) => item.id === transition.id),
  ).toBe(true);
  expect(seedBuiltInAgents(home)).toHaveLength(listAgents(home).length);
});

test('agent seeding supplies a default objective when a definition omits one', () => {
  const home = initHome();
  const definitionsDir = join(tempHome(), 'agents');
  mkdirSync(definitionsDir);
  writeFileSync(
    join(definitionsDir, 'focused.json'),
    JSON.stringify({ id: 'focused-agent', slug: 'focused', name: 'Focused agent' }),
  );

  seedBuiltInAgents(home, { definitionsDir });
  expect(getAgentBySlug('focused', home)?.defaultGoal).toContain('Run focused');
});
