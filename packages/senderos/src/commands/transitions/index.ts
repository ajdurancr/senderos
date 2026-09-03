import { openRuntimeDb } from '../../db/client';
import { mapAgentTransitionRow } from '../../db/mappers';
import type { AgentTransitionRecord } from '../../shared/types';
import { now, randomId } from '../../shared/ids';
import { emitEvent } from '../../shared/events';

export function createAgentTransition(input: {
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
    id: randomId('transition'), sourceAgentId: input.sourceAgentId,
    targetAgentId: input.targetAgentId ?? null, name: input.name,
    description: input.description ?? '', status: input.status ?? 'active',
    transitionObjective: input.transitionObjective,
    assignmentMetaJson: JSON.stringify(input.assignmentMeta ?? {}),
    createdAt: ts, updatedAt: ts,
  };
  db.prepare('insert into agent_transitions (id,source_agent_id,target_agent_id,name,description,status,transition_objective,assignment_meta_json,created_at,updated_at) values (?,?,?,?,?,?,?,?,?,?)').run(
    record.id, record.sourceAgentId, record.targetAgentId, record.name, record.description,
    record.status, record.transitionObjective, record.assignmentMetaJson, ts, ts,
  );
  emitEvent(db, 'agent-transition.created', 'agent-transition', record.id, {
    sourceAgentId: record.sourceAgentId, targetAgentId: record.targetAgentId,
  });
  db.close();
  return record;
}

export function listAgentTransitions(home?: string) {
  const db = openRuntimeDb(home);
  const rows = db.query('select * from agent_transitions order by created_at asc').all().map(mapAgentTransitionRow) as AgentTransitionRecord[];
  db.close();
  return rows;
}

export function getAgentTransition(id: string, home?: string) {
  const db = openRuntimeDb(home);
  const row = mapAgentTransitionRow(db.query('select * from agent_transitions where id=?').get(id));
  db.close();
  return row;
}

export function listAgentTransitionsForAgent(agentId: string, home?: string) {
  return listAgentTransitions(home).filter((item) => item.sourceAgentId === agentId);
}
