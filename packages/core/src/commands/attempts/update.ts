import { openRuntimeDb } from '../../db/client';
import { now } from '../../shared/ids';
import { emitEvent } from '../../shared/events';
import type { RunAttemptRecord } from '../../shared/types';
import { getRunAttempt } from './get';
import { sql } from 'drizzle-orm';

export async function updateRunAttempt(
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
  const current = await getRunAttempt(id, home);
  if (!current) throw new Error(`Run attempt not found: ${id}`);
  const db = openRuntimeDb(home);
  await db.run(sql`update run_attempts set status=${input.status ?? current.status},checkpoint=${input.checkpoint ?? current.checkpoint},working_path=${input.workingPath ?? current.workingPath},working_path_mode=${input.workingPathMode ?? current.workingPathMode},external_session_id=${input.externalSessionId ?? current.externalSessionId},resume_command=${input.resumeCommand ?? current.resumeCommand},heartbeat_at=${input.heartbeatAt ?? current.heartbeatAt},failure_step=${input.failureStep ?? current.failureStep},failure_summary=${input.failureSummary ?? current.failureSummary},result_json=${JSON.stringify(input.result ?? JSON.parse(current.resultJson))},status_snapshot_json=${JSON.stringify(input.statusSnapshot ?? JSON.parse(current.statusSnapshotJson))},finished_at=${input.finishedAt ?? current.finishedAt},updated_at=${now()} where id=${id}`);
  await emitEvent(db, 'run-attempt.updated', 'run-attempt', id, {
    status: input.status, checkpoint: input.checkpoint, failureStep: input.failureStep,
    hasResult: input.result !== undefined, hasStatusSnapshot: input.statusSnapshot !== undefined,
  });
  if (
    input.status &&
    ['succeeded', 'failed', 'canceled'].includes(input.status)
  ) {
    await db.run(sql`update runs set status=${input.status === 'succeeded' ? 'succeeded' : input.status},updated_at=${now()} where id=${current.runId}`);
    if (input.status === 'failed')
      await db.run(sql`update goals set status='failed',updated_at=${now()} where id=(select goal_id from runs where id=${current.runId})`);
  }
  return getRunAttempt(id, home);
}
