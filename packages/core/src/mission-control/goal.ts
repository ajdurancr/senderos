import { listAgents } from '../commands/agents/list';
import { listAgentTransitions } from '../commands/transitions/list';
import { showRunState } from '../commands/runs/show-state';
import { listEvents } from '../shared/events';

export async function missionControlGoal(input: { goalId: string; home?: string }) {
  const state = await showRunState(input.goalId, input.home);
  const entityIds = new Set([input.goalId, state.run?.id, ...state.attempts.map((attempt) => attempt.id)]);
  return {
    ...state,
    agents: await listAgents(input.home),
    transitions: await listAgentTransitions(input.home),
    events: (await listEvents({ home: input.home })).filter((event) => entityIds.has(event.entityId)),
  };
}
