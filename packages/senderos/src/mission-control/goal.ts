import { listAgents } from '../commands/agents/list';
import { listAgentTransitions } from '../commands/transitions/list';
import { showRunState } from '../commands/runs/show-state';
import { listEvents } from '../shared/events';

export function missionControlGoal(input: { goalId: string; home?: string }) {
  return { ...showRunState(input.goalId, input.home), agents: listAgents(input.home), transitions: listAgentTransitions(input.home), events: listEvents({ home: input.home }) };
}
