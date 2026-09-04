import { openRuntimeDb } from '../../db/client';
import { mapRunAttemptRow } from '../../db/mappers';
import type { RunAttemptRecord } from '../../shared/types';

export function listRunAttempts(
  runId?: string,
  home?: string,
): RunAttemptRecord[] {
  const db = openRuntimeDb(home);
  const rows = (
    runId
      ? db
          .query(
            'select * from run_attempts where run_id=? order by attempt_number asc',
          )
          .all(runId)
      : db.query('select * from run_attempts order by created_at asc').all()
  ).map(mapRunAttemptRow) as RunAttemptRecord[];
  db.close();
  return rows;
}
