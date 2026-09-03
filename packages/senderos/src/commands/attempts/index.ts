import { openRuntimeDb } from '../../db/client';
import { mapRunAttemptRow } from '../../db/mappers';
import type { HarnessKind, RunAttemptRecord } from '../../shared/types';
import { now, randomId } from '../../shared/ids';
import { emitEvent } from '../../shared/events';

export function createRunAttempt(input: {
  home?: string;
  runId: string;
  attemptNumber: number;
  agentId: string;
  transitionId?: string | null;
  executionObjective: string;
  harness: HarnessKind;
  externalSessionId?: string | null;
  resumeCommand?: string | null;
  heartbeatAt?: string | null;
  hostEnvironmentName?: string | null;
  workingPath?: string | null;
  workingPathMode?: string | null;
  retryFromAttemptId?: string | null;
  checkpoint?: string | null;
  sourceGoalSha?: string | null;
  status?: RunAttemptRecord['status'];
  debugMeta?: Record<string, unknown>;
  startedAt?: string | null;
}) {
  const db = openRuntimeDb(input.home);
  const ts = now();
  const record: RunAttemptRecord = {
    id: randomId('attempt'), runId: input.runId, attemptNumber: input.attemptNumber,
    agentId: input.agentId, transitionId: input.transitionId ?? null,
    status: input.status ?? 'queued', executionObjective: input.executionObjective,
    harness: input.harness, externalSessionId: input.externalSessionId ?? null,
    resumeCommand: input.resumeCommand ?? null, heartbeatAt: input.heartbeatAt ?? null,
    hostEnvironmentName: input.hostEnvironmentName ?? null,
    workingPath: input.workingPath ?? null, workingPathMode: input.workingPathMode ?? null,
    retryFromAttemptId: input.retryFromAttemptId ?? null, checkpoint: input.checkpoint ?? null,
    sourceGoalSha: input.sourceGoalSha ?? null, failureStep: null, statusSnapshotJson: '{}',
    resultJson: '{}', failureSummary: null, debugMetaJson: JSON.stringify(input.debugMeta ?? {}),
    startedAt: input.startedAt ?? null, finishedAt: null, createdAt: ts, updatedAt: ts,
  };
  db.prepare(
    'insert into run_attempts (id,run_id,attempt_number,agent_id,transition_id,status,execution_objective,harness,external_session_id,resume_command,heartbeat_at,host_environment_name,working_path,working_path_mode,retry_from_attempt_id,checkpoint,source_goal_sha,failure_step,status_snapshot_json,result_json,failure_summary,debug_meta_json,started_at,finished_at,created_at,updated_at) values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
  ).run(
    record.id, record.runId, record.attemptNumber, record.agentId, record.transitionId,
    record.status, record.executionObjective, record.harness, record.externalSessionId,
    record.resumeCommand, record.heartbeatAt, record.hostEnvironmentName, record.workingPath,
    record.workingPathMode, record.retryFromAttemptId, record.checkpoint, record.sourceGoalSha,
    record.failureStep, record.statusSnapshotJson, record.resultJson, record.failureSummary,
    record.debugMetaJson, record.startedAt, record.finishedAt, ts, ts,
  );
  emitEvent(db, 'run-attempt.created', 'run-attempt', record.id, { runId: record.runId, attemptNumber: record.attemptNumber });
  db.close();
  return record;
}

export function getRunAttempt(id: string, home?: string) {
  const db = openRuntimeDb(home);
  const row = mapRunAttemptRow(db.query('select * from run_attempts where id=?').get(id));
  db.close();
  return row;
}

export function listRunAttempts(runId?: string, home?: string) {
  const db = openRuntimeDb(home);
  const rows = (runId
    ? db.query('select * from run_attempts where run_id=? order by attempt_number asc').all(runId)
    : db.query('select * from run_attempts order by created_at asc').all()
  ).map(mapRunAttemptRow) as RunAttemptRecord[];
  db.close();
  return rows;
}

export function updateRunAttempt(
  id: string,
  input: Partial<Pick<RunAttemptRecord, 'status' | 'checkpoint' | 'workingPath' | 'workingPathMode' | 'externalSessionId' | 'resumeCommand' | 'heartbeatAt' | 'failureStep' | 'failureSummary' | 'finishedAt'>> & { result?: Record<string, unknown>; statusSnapshot?: Record<string, unknown> },
  home?: string,
) {
  const current = getRunAttempt(id, home);
  if (!current) throw new Error(`Run attempt not found: ${id}`);
  const db = openRuntimeDb(home);
  db.prepare('update run_attempts set status=?,checkpoint=?,working_path=?,working_path_mode=?,external_session_id=?,resume_command=?,heartbeat_at=?,failure_step=?,failure_summary=?,result_json=?,status_snapshot_json=?,finished_at=?,updated_at=? where id=?').run(
    input.status ?? current.status, input.checkpoint ?? current.checkpoint,
    input.workingPath ?? current.workingPath, input.workingPathMode ?? current.workingPathMode,
    input.externalSessionId ?? current.externalSessionId, input.resumeCommand ?? current.resumeCommand,
    input.heartbeatAt ?? current.heartbeatAt, input.failureStep ?? current.failureStep,
    input.failureSummary ?? current.failureSummary, JSON.stringify(input.result ?? JSON.parse(current.resultJson)),
    JSON.stringify(input.statusSnapshot ?? JSON.parse(current.statusSnapshotJson)),
    input.finishedAt ?? current.finishedAt, now(), id,
  );
  if (input.status && ['succeeded', 'failed', 'canceled'].includes(input.status)) {
    const runStatus = input.status === 'succeeded' ? 'succeeded' : input.status;
    db.prepare('update runs set status=?,updated_at=? where id=?').run(runStatus, now(), current.runId);
    if (input.status === 'failed') db.prepare("update goals set status='failed',updated_at=? where id=(select goal_id from runs where id=?)").run(now(), current.runId);
  }
  db.close();
  return getRunAttempt(id, home);
}
