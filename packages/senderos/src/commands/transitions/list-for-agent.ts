import { listAgentTransitions } from './list';
export function listAgentTransitionsForAgent(agentId: string, home?: string) {
  return listAgentTransitions(home).filter(
    (item) => item.sourceAgentId === agentId,
  );
}
