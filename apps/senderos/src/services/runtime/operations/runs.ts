import { openRuntimeDb } from '../../../db/client';
import { now } from '../../../utils/common';
import { emitEvent } from '../../events';
import { getRun } from '../../sendero-supervisor';
import { updateRunExecutionByRunId } from '../agents';
import { cancelFeature, getFeature } from '../features';
import { advanceSupervision, showSupervision, startSupervision } from './sendero-supervisor';

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

  if (!feature.currentRunId) {
    if (input.previousRunId) {
      throw new Error('previous-run-id is not valid when the feature has no current run');
    }

    const started: any = startSupervision(feature.id, home, {
      senderoId: input.senderoId,
      agentId: input.agentId,
    });

    return {
      featureId: feature.id,
      previousRunId: null,
      runId: started.run?.id ?? null,
      runExecutionId: started.runExecution?.id ?? null,
      sessionId: started.session?.id ?? null,
    };
  }

  if (input.previousRunId !== feature.currentRunId) {
    throw new Error('previous-run-id must match the feature current run id');
  }

  const currentRun: any = getRun(feature.currentRunId, home);
  if (!currentRun) {
    throw new Error(`Current run not found: ${feature.currentRunId}`);
  }

  if (currentRun.status === 'succeeded') {
    const advanced: any = advanceSupervision(feature.id, home);
    return {
      featureId: feature.id,
      previousRunId: input.previousRunId,
      runId: advanced.run?.id ?? null,
      runExecutionId: advanced.runExecution?.id ?? null,
      sessionId: advanced.run ? showSupervision(feature.id, home).currentRunExecution?.hostEnvironmentSessionId ?? null : null,
    };
  }

  if (currentRun.status === 'failed') {
    const retried: any = startSupervision(feature.id, home, {
      senderoId: input.senderoId,
      agentId: input.agentId,
    });

    return {
      featureId: feature.id,
      previousRunId: input.previousRunId,
      runId: retried.run?.id ?? null,
      runExecutionId: retried.runExecution?.id ?? null,
      sessionId: retried.session?.id ?? null,
    };
  }

  if (currentRun.status === 'canceled') {
    throw new Error(`Run is not dispatchable from status ${currentRun.status}`);
  }

  const advanced: any = advanceSupervision(feature.id, home);
  return {
    featureId: feature.id,
    previousRunId: input.previousRunId,
    runId: advanced.run?.id ?? null,
    runExecutionId: advanced.runExecution?.id ?? null,
    sessionId: advanced.run ? showSupervision(feature.id, home).currentRunExecution?.hostEnvironmentSessionId ?? null : null,
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

  if (run.task_id) {
    db.prepare('update tasks set status=?, updated_at=? where id=?').run('canceled', now(), run.task_id);
  }

  emitEvent(db, 'run.canceled', 'run', id, { cancelScope: 'feature' });
  db.close();

  updateRunExecutionByRunId(
    id,
    {
      status: 'canceled',
      checkpoint: 'run_canceled',
      failureSummary: 'Run canceled by SenderOS.',
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
