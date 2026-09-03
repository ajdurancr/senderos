import { openRuntimeDb } from '../../db/client';
import { mapAgentTransitionRow } from '../../db/mappers';
export function getAgentTransition(id: string, home?: string) { const db = openRuntimeDb(home); const row = mapAgentTransitionRow(db.query('select * from agent_transitions where id=?').get(id)); db.close(); return row; }
