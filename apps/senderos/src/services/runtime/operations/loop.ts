import {
  getRun,
  getSession,
  getWorkspace,
  listTasks,
  startLoopForFeature,
  tickLoopForFeature,
} from '../../loop';
import { getFeature } from '../features';

export function startLoop(featureId: string, home?: string) {
  const feature = getFeature(featureId, home);

  if (!feature) {
    throw new Error(`Feature not found: ${featureId}`);
  }

  if (!['ready_contract', 'active_implementation', 'failed'].includes(feature.status)) {
    throw new Error(`Feature is not dispatchable from status ${feature.status}`);
  }

  const result = startLoopForFeature(feature, home);

  return {
    feature: getFeature(feature.id, home),
    run: result.run,
    session: result.session,
    task: result.task,
  };
}

export function tickLoop(featureId: string, home?: string) {
  const feature = getFeature(featureId, home);

  if (!feature) {
    throw new Error(`Feature not found: ${featureId}`);
  }

  const result = tickLoopForFeature(feature, home);

  return {
    feature: getFeature(feature.id, home),
    run: result.run,
    task: result.task,
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
    workspace: feature.currentWorkspaceId ? getWorkspace(feature.currentWorkspaceId, home) : null,
    nextDispatch: nextTask ? JSON.parse(nextTask.instructionJson) : null,
  };
}

export function resumeSession(id: string, home?: string) {
  const row = getSession(id, home) as any;

  if (!row) {
    throw new Error(`Session not found: ${id}`);
  }

  return {
    session: row,
    resumeCommand: row.resume_command ?? row.resumeCommand,
    harness: row.harness,
  };
}
