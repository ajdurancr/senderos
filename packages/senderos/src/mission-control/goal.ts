import { listAgents, listAgentTransitions } from '../commands/agents';
import { showRunState } from '../commands/executions';
import { listEvents } from '../shared/events';

export function missionControlGoal(input: { goalId: string; home?: string }) {
  return { ...showRunState(input.goalId, input.home), agents: listAgents(input.home), transitions: listAgentTransitions(input.home), events: listEvents({ home: input.home }) };
}
