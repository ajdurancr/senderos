import { openRuntimeDb } from '../../db/client';
import { emitEvent } from '../../shared/events';
import { now, randomId } from '../../shared/ids';
import type { AgentTransitionRecord } from '../../shared/types';
import { agentTransitions } from '../../db/schema';
export async function createAgentTransition(input: {
  home?: string;
  sourceAgentId: string;
  targetAgentId?: string | null;
  name: string;
  description?: string;
  transitionObjective: string;
  status?: AgentTransitionRecord['status'];
  assignmentMeta?: Record<string, unknown>;
}) {
  const db = openRuntimeDb(input.home);
  const ts = now();
  const record: AgentTransitionRecord = {
    id: randomId('transition'),
    sourceAgentId: input.sourceAgentId,
    targetAgentId: input.targetAgentId ?? null,
    name: input.name,
    description: input.description ?? '',
    status: input.status ?? 'active',
    transitionObjective: input.transitionObjective,
    assignmentMetaJson: JSON.stringify(input.assignmentMeta ?? {}),
    createdAt: ts,
    updatedAt: ts,
  };
  await db.insert(agentTransitions).values(record);
  await emitEvent(db, 'agent-transition.created', 'agent-transition', record.id, {
    sourceAgentId: record.sourceAgentId,
    targetAgentId: record.targetAgentId,
  });
  return record;
}
