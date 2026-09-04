import { listAgents } from '../commands/agents/list';
import { listAgentTransitions } from '../commands/transitions/list';
import { showRunState } from '../commands/runs/show-state';
import { listEvents } from '../shared/events';

export function missionControlGoal(input: { goalId: string; home?: string }) {
  const state = showRunState(input.goalId, input.home);
  const entityIds = new Set([input.goalId, state.run?.id, ...state.attempts.map((attempt) => attempt.id)]);
  return {
    ...state,
    agents: listAgents(input.home),
    transitions: listAgentTransitions(input.home),
    events: listEvents({ home: input.home }).filter((event) => entityIds.has(event.entityId)),
  };
}
