import { openRuntimeDb } from '../../../db/client';
import { now } from '../../../utils/common';
import { emitEvent } from '../../events';
import {
  advanceSupervision,
  getRun,
  getSession,
  getWorkspace,
  listTasks,
  superviseFeature,
} from '../../run-state';
import { getRunExecutionByRunId, updateRunExecutionByRunId } from '../agents';
import { cancelFeature, getFeature } from '../features';

function startRunState(
  featureId: string,
  home?: string,
  options?: { agentId?: string; senderoId?: string }
) {
  const feature = getFeature(featureId, home);

  if (!feature) {
    throw new Error(`Feature not found: ${featureId}`);
  }

  if (!['active', 'failed'].includes(feature.status)) {
    throw new Error(`Feature is not dispatchable from status ${feature.status}`);
  }

  const result = superviseFeature(feature, home, options);

  return {
    feature: getFeature(feature.id, home),
    run: result.run,
    session: result.session,
    task: result.task,
    runExecution: result.runExecution,
  };
}

function advanceRunState(featureId: string, home?: string) {
  const feature = getFeature(featureId, home);

  if (!feature) {
    throw new Error(`Feature not found: ${featureId}`);
  }

  const result = advanceSupervision(feature, home);
  const nextRun = result.run as { id?: string } | null;

  return {
    feature: getFeature(feature.id, home),
    run: result.run,
    task: result.task,
    runExecution: nextRun?.id ? getRunExecutionByRunId(nextRun.id, home) : null,
  };
}

export function showRunState(featureId: string, home?: string) {
  const feature = getFeature(featureId, home);

  if (!feature) {
    throw new Error(`Feature not found: ${featureId}`);
  }

  const tasks = listTasks(featureId, home) as any[];
  const nextTask = tasks.find((task) => ['ready', 'running', 'pending'].includes(task.status));

  return {
    feature,
    tasks,
    currentRun: feature.currentRunId ? getRun(feature.currentRunId, home) : null,
    currentRunExecution: feature.currentRunId ? getRunExecutionByRunId(feature.currentRunId, home) : null,
    workspace: feature.currentWorkspaceId ? getWorkspace(feature.currentWorkspaceId, home) : null,
    nextDispatch: nextTask ? JSON.parse(nextTask.instructionJson) : null,
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

  if (!feature.currentRunId) {
    if (input.previousRunId) {
      throw new Error('previous-run-id is not valid when the feature has no current run');
    }

    const started: any = startRunState(feature.id, home, {
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

  if (currentRun.status === 'failed') {
    const retried: any = startRunState(feature.id, home, {
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

  const advanced: any = advanceRunState(feature.id, home);
  return {
    featureId: feature.id,
    previousRunId: input.previousRunId,
    runId: advanced.run?.id ?? null,
    runExecutionId: advanced.runExecution?.id ?? null,
    sessionId: advanced.run ? showRunState(feature.id, home).currentRunExecution?.hostEnvironmentSessionId ?? null : null,
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

  const snapshot = JSON.parse(row.status_snapshot_json ?? row.statusSnapshotJson ?? '{}');

  return {
    session: row,
    resumeCommand: row.resume_command ?? row.resumeCommand,
    launchCommand: snapshot.launchCommand ?? null,
  };
}
