import { openRuntimeDb } from '../../db/client';
import { now } from '../../shared/ids';
import type { RunAttemptRecord } from '../../shared/types';
import { getRunAttempt } from './get';

export function updateRunAttempt(
  id: string,
  input: Partial<
    Pick<
      RunAttemptRecord,
      | 'status'
      | 'checkpoint'
      | 'workingPath'
      | 'workingPathMode'
      | 'externalSessionId'
      | 'resumeCommand'
      | 'heartbeatAt'
      | 'failureStep'
      | 'failureSummary'
      | 'finishedAt'
    >
  > & {
    result?: Record<string, unknown>;
    statusSnapshot?: Record<string, unknown>;
  },
  home?: string,
) {
  const current = getRunAttempt(id, home);
  if (!current) throw new Error(`Run attempt not found: ${id}`);
  const db = openRuntimeDb(home);
  db.prepare(
    'update run_attempts set status=?,checkpoint=?,working_path=?,working_path_mode=?,external_session_id=?,resume_command=?,heartbeat_at=?,failure_step=?,failure_summary=?,result_json=?,status_snapshot_json=?,finished_at=?,updated_at=? where id=?',
  ).run(
    input.status ?? current.status,
    input.checkpoint ?? current.checkpoint,
    input.workingPath ?? current.workingPath,
    input.workingPathMode ?? current.workingPathMode,
    input.externalSessionId ?? current.externalSessionId,
    input.resumeCommand ?? current.resumeCommand,
    input.heartbeatAt ?? current.heartbeatAt,
    input.failureStep ?? current.failureStep,
    input.failureSummary ?? current.failureSummary,
    JSON.stringify(input.result ?? JSON.parse(current.resultJson)),
    JSON.stringify(
      input.statusSnapshot ?? JSON.parse(current.statusSnapshotJson),
    ),
    input.finishedAt ?? current.finishedAt,
    now(),
    id,
  );
  if (
    input.status &&
    ['succeeded', 'failed', 'canceled'].includes(input.status)
  ) {
    db.prepare('update runs set status=?,updated_at=? where id=?').run(
      input.status === 'succeeded' ? 'succeeded' : input.status,
      now(),
      current.runId,
    );
    if (input.status === 'failed')
      db.prepare(
        "update goals set status='failed',updated_at=? where id=(select goal_id from runs where id=?)",
      ).run(now(), current.runId);
  }
  db.close();
  return getRunAttempt(id, home);
}
