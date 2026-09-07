import { openRuntimeDb } from '../../db/client';
import { emitEvent } from '../../shared/events';
import { now, randomId } from '../../shared/ids';
import type { HarnessKind, RunAttemptRecord } from '../../shared/types';
import { runAttempts } from '../../db/schema';

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
  await db.insert(runAttempts).values(record);
  await emitEvent(db, 'run-attempt.created', 'run-attempt', record.id, {
    runId: record.runId,
    attemptNumber: record.attemptNumber,
  });
  return record;
}
