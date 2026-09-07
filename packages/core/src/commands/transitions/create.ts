import { openRuntimeDb } from '../../db/client';
import { emitEvent } from '../../shared/events';
import { now, randomId } from '../../shared/ids';
import type { AgentTransitionRecord } from '../../shared/types';
import { sql } from 'drizzle-orm';
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
  await db.run(sql`insert into agent_transitions (id,source_agent_id,target_agent_id,name,description,status,transition_objective,assignment_meta_json,created_at,updated_at) values (${record.id},${record.sourceAgentId},${record.targetAgentId},${record.name},${record.description},${record.status},${record.transitionObjective},${record.assignmentMetaJson},${ts},${ts})`);
  await emitEvent(db, 'agent-transition.created', 'agent-transition', record.id, {
    sourceAgentId: record.sourceAgentId,
    targetAgentId: record.targetAgentId,
  });
  return record;
}
