import { listAgents } from '../commands/agents';
import { listAgentTransitions } from '../commands/transitions';
import { showRunState } from '../commands/runs/execution';
import { listEvents } from '../shared/events';

export function missionControlGoal(input: { goalId: string; home?: string }) {
  return { ...showRunState(input.goalId, input.home), agents: listAgents(input.home), transitions: listAgentTransitions(input.home), events: listEvents({ home: input.home }) };
}
