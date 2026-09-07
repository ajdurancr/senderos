import { openRuntimeDb } from '../../db/client';
import { emitEvent } from '../../shared/events';
import { now, randomId } from '../../shared/ids';
import type { HarnessKind, RunAttemptRecord } from '../../shared/types';
import { sql } from 'drizzle-orm';

export async function createRunAttempt(input: {
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
    id: randomId('attempt'),
    runId: input.runId,
    attemptNumber: input.attemptNumber,
    agentId: input.agentId,
    transitionId: input.transitionId ?? null,
    status: input.status ?? 'queued',
    executionObjective: input.executionObjective,
    harness: input.harness,
    externalSessionId: input.externalSessionId ?? null,
    resumeCommand: input.resumeCommand ?? null,
    heartbeatAt: input.heartbeatAt ?? null,
    hostEnvironmentName: input.hostEnvironmentName ?? null,
    workingPath: input.workingPath ?? null,
    workingPathMode: input.workingPathMode ?? null,
    retryFromAttemptId: input.retryFromAttemptId ?? null,
    checkpoint: input.checkpoint ?? null,
    sourceGoalSha: input.sourceGoalSha ?? null,
    failureStep: null,
    statusSnapshotJson: '{}',
    resultJson: '{}',
    failureSummary: null,
    debugMetaJson: JSON.stringify(input.debugMeta ?? {}),
    startedAt: input.startedAt ?? null,
    finishedAt: null,
    createdAt: ts,
    updatedAt: ts,
  };
  await db.run(sql`insert into run_attempts (id,run_id,attempt_number,agent_id,transition_id,status,execution_objective,harness,external_session_id,resume_command,heartbeat_at,host_environment_name,working_path,working_path_mode,retry_from_attempt_id,checkpoint,source_goal_sha,failure_step,status_snapshot_json,result_json,failure_summary,debug_meta_json,started_at,finished_at,created_at,updated_at) values (${record.id},${record.runId},${record.attemptNumber},${record.agentId},${record.transitionId},${record.status},${record.executionObjective},${record.harness},${record.externalSessionId},${record.resumeCommand},${record.heartbeatAt},${record.hostEnvironmentName},${record.workingPath},${record.workingPathMode},${record.retryFromAttemptId},${record.checkpoint},${record.sourceGoalSha},${record.failureStep},${record.statusSnapshotJson},${record.resultJson},${record.failureSummary},${record.debugMetaJson},${record.startedAt},${record.finishedAt},${ts},${ts})`);
  await emitEvent(db, 'run-attempt.created', 'run-attempt', record.id, {
    runId: record.runId,
    attemptNumber: record.attemptNumber,
  });
  return record;
}
