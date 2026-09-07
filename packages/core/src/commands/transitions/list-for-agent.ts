import { listAgentTransitions } from './list';
export async function listAgentTransitionsForAgent(agentId: string, home?: string) {
  return (await listAgentTransitions(home)).filter(
    (item) => item.sourceAgentId === agentId,
  );
}
