import {
  getRun,
  getSession,
  getWorkspace,
  listTasks,
  superviseFeature,
  advanceSupervision as advanceFeatureSupervision,
} from '../../sendero-supervisor';
import { getRunExecutionByRunId } from '../agents';
import { getFeature, listFeatures } from '../features';
import { listSessions } from './runs';

export function startSupervision(
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

export function advanceSupervision(featureId: string, home?: string) {
  const feature = getFeature(featureId, home);

  if (!feature) {
    throw new Error(`Feature not found: ${featureId}`);
  }

  const result = advanceFeatureSupervision(feature, home);
  const nextRun = result.run as { id?: string } | null;

  return {
    feature: getFeature(feature.id, home),
    run: result.run,
    task: result.task,
    runExecution: nextRun?.id ? getRunExecutionByRunId(nextRun.id, home) : null,
  };
}

export function showSupervision(featureId: string, home?: string) {
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

export function orchestrateSupervisions(home?: string) {
  const features = listFeatures(home).filter((feature) => !['completed', 'canceled', 'blocked'].includes(feature.status));
  const results: Array<Record<string, unknown>> = [];

  for (const feature of features) {
    if (!feature.currentRunId) {
      const started = startSupervision(feature.id, home) as { run?: { id?: string } | null };
      results.push({ featureId: feature.id, action: 'started', runId: started.run?.id ?? null });
      continue;
    }

    const currentRun: any = getRun(feature.currentRunId, home);
    const activeSession = currentRun
      ? ((listSessions(home) as any[]).find((session) => session.run_id === currentRun.id && session.status === 'active') ?? null)
      : null;

    const sessionActive = activeSession?.status === 'active';

    if (sessionActive) {
      results.push({ featureId: feature.id, action: 'noop_running', runId: feature.currentRunId });
      continue;
    }

    if (currentRun?.status === 'succeeded') {
      const advanced = advanceSupervision(feature.id, home) as { run?: { id?: string } | null };
      results.push({
        featureId: feature.id,
        action: 'advanced',
        previousRunId: feature.currentRunId,
        nextRunId: advanced.run?.id ?? null,
      });
      continue;
    }

    if (['failed', 'canceled'].includes(currentRun?.status)) {
      results.push({ featureId: feature.id, action: 'halted', runId: feature.currentRunId, runStatus: currentRun.status });
      continue;
    }

    results.push({ featureId: feature.id, action: 'noop_unknown', runId: feature.currentRunId, runStatus: currentRun?.status ?? null });
  }

  return {
    scanned: features.length,
    results,
  };
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
    harness: row.harness,
  };
}
