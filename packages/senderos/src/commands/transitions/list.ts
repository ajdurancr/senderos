import { openRuntimeDb } from '../../db/client';
import { mapAgentTransitionRow } from '../../db/mappers';
import type { AgentTransitionRecord } from '../../shared/types';
export function listAgentTransitions(home?: string): AgentTransitionRecord[] { const db = openRuntimeDb(home); const rows = db.query('select * from agent_transitions order by created_at asc').all().map(mapAgentTransitionRow) as AgentTransitionRecord[]; db.close(); return rows; }
