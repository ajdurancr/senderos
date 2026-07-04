import {
  getRun,
  getSession,
  getWorkspace,
  listTasks,
  startLoopForFeature,
  tickLoopForFeature,
} from '../../loop';
import { getAgentRunByRunId } from '../agents';
import { getFeature } from '../features';

export function startLoop(featureId: string, home?: string) {
  const feature = getFeature(featureId, home);

  if (!feature) {
    throw new Error(`Feature not found: ${featureId}`);
  }

  if (!['active', 'failed'].includes(feature.status)) {
    throw new Error(`Feature is not dispatchable from status ${feature.status}`);
  }

  const result = startLoopForFeature(feature, home);

  return {
    feature: getFeature(feature.id, home),
    run: result.run,
    session: result.session,
    task: result.task,
    agentRun: result.agentRun,
  };
}

export function tickLoop(featureId: string, home?: string) {
  const feature = getFeature(featureId, home);

  if (!feature) {
    throw new Error(`Feature not found: ${featureId}`);
  }

  const result = tickLoopForFeature(feature, home);

  const nextRun = result.run as { id?: string } | null;

  return {
    feature: getFeature(feature.id, home),
    run: result.run,
    task: result.task,
    agentRun: nextRun?.id ? getAgentRunByRunId(nextRun.id, home) : null,
  };
}

export function showLoop(featureId: string, home?: string) {
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
    currentAgentRun: feature.currentRunId ? getAgentRunByRunId(feature.currentRunId, home) : null,
    workspace: feature.currentWorkspaceId ? getWorkspace(feature.currentWorkspaceId, home) : null,
    nextDispatch: nextTask ? JSON.parse(nextTask.instructionJson) : null,
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
