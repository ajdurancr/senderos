import { expect, test } from 'bun:test';
import { getAgentBySlug } from '../agents/get-by-slug';
import {
  createAgentTransition,
  getAgentTransition,
  listAgentTransitionsForAgent,
} from '.';
import { initHome } from '../../test-support/runtime';

test('transition commands create, read, and filter agent handoffs', () => {
  const home = initHome();
  const agent = getAgentBySlug('spec-partner', home)!;
  const transition = createAgentTransition({
    home,
    sourceAgentId: agent.id,
    name: 'Implement handoff',
    transitionObjective: 'Implement the approved work.',
  });

  expect(getAgentTransition(transition.id, home)?.id).toBe(transition.id);
  expect(listAgentTransitionsForAgent(agent.id, home)).toContainEqual(transition);
});
