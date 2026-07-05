import { openRuntimeDb } from '../../../db/client';
import { now } from '../../../utils/common';
import { emitEvent } from '../../events';
import { getRunExecutionByRunId, updateRunExecutionByRunId } from '../agents';
import { cancelFeature, getFeature } from '../features';
import { attachRunToFeature, createRunExecutionRecord, createRunRecord, createSessionRecord, getRun, getSession } from './dispatch';

export function showRunState(featureId: string, home?: string) {
  const feature = getFeature(featureId, home);

  if (!feature) {
    throw new Error(`Feature not found: ${featureId}`);
  }

  return {
    feature,
    currentRun: feature.currentRunId ? getRun(feature.currentRunId, home) : null,
    currentRunExecution: feature.currentRunId ? getRunExecutionByRunId(feature.currentRunId, home) : null,
  };
}

export function listRuns(home?: string) {
  const db = openRuntimeDb(home);
  const rows = db.query('select * from runs order by created_at asc').all();
  db.close();
  return rows;
}

export function dispatchRun(
  input: { featureId: string; senderoId: string; agentId: string; previousRunId?: string },
  home?: string
) {
  const feature = getFeature(input.featureId, home);
  if (!feature) {
    throw new Error(`Feature not found: ${input.featureId}`);
  }

  if (feature.currentRunId !== (input.previousRunId ?? null)) {
    throw new Error('previous-run-id must match the feature current run id');
  }

  if (feature.currentRunId) {
    const previousRun: any = getRun(feature.currentRunId, home);
    if (!previousRun) {
      throw new Error(`Current run not found: ${feature.currentRunId}`);
    }
    if (!['failed', 'succeeded'].includes(previousRun.status)) {
      throw new Error(`Run is not dispatchable from status ${previousRun.status}`);
    }
    const previousSession = (listSessions(home) as any[]).find((session) => session.run_id === previousRun.id && session.status === 'active');
    if (previousSession) {
      throw new Error('Run is still active and cannot be redispatched');
    }
  }

  const run: any = createRunRecord(feature, input.senderoId, input.previousRunId ?? null, home);
  const session: any = createSessionRecord(run.id, home);
  const execution: any = createRunExecutionRecord({
    feature,
    runId: run.id,
    sessionId: session.id,
    senderoId: input.senderoId,
    agentId: input.agentId,
    previousRunId: input.previousRunId ?? null,
    home,
  });
  attachRunToFeature(feature.id, run.id, home);

  return {
    featureId: feature.id,
    previousRunId: input.previousRunId ?? null,
    runId: run.id,
    runExecutionId: execution?.id ?? null,
    sessionId: session.id,
  };
}

export function cancelRun(id: string, home?: string) {
  const db = openRuntimeDb(home);
  const run = db.query('select * from runs where id=?').get(id) as any;

  if (!run) {
    db.close();
    throw new Error(`Run not found: ${id}`);
  }

  db.prepare('update runs set status=?, updated_at=? where id=?').run('canceled', now(), id);
  db.prepare('update sessions set status=?, updated_at=? where run_id=? and status=?').run('completed', now(), id, 'active');
  emitEvent(db, 'run.canceled', 'run', id, { cancelScope: 'feature' });
  db.close();

  updateRunExecutionByRunId(
    id,
    {
      status: 'canceled',
      checkpoint: 'run_canceled',
      failureSummary: 'Run canceled by Senderos.',
      finishedAt: now(),
    },
    home
  );

  const feature = getFeature(run.feature_id, home);
  if (feature) {
    cancelFeature(feature.id, home);
  }

  return getRun(id, home);
}

export function listSessions(home?: string) {
  const db = openRuntimeDb(home);
  const rows = db.query('select * from sessions order by created_at asc').all();
  db.close();
  return rows;
}

export function resumeSession(id: string, home?: string) {
  const row = getSession(id, home) as any;

  if (!row) {
    throw new Error(`Session not found: ${id}`);
  }

  return {
    session: row,
    resumeCommand: row.resume_command ?? row.resumeCommand,
  };
}
