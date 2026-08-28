import { expect, test } from 'bun:test';
import {
  createAgentTransition,
  getAgentBySlug,
  listAgentTransitions,
  listAgents,
} from './agents';
import { initHome } from '../../../tests/helpers/runtime';

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
});
