import { nextPhase } from '../../domain/constants';
import type { FeatureRecord } from '../../domain/types';
import { openConfiguredCommandDb } from '../../db/client';
import { now } from '../../utils/common';
import { emitEvent } from '../events';
import { completeActiveSessionsForFeature } from '../session-lifecycle';
import { cleanupWorkspace, dispatchForPhase } from './dispatch';
import { listTasks } from './queries';
import { ensurePhaseTask, updateTaskStatus } from './tasks';

export function startLoopForFeature(feature: FeatureRecord, home?: string) {
  const phase = feature.loopPhase === 'idle' ? 'implementation' : feature.loopPhase;
  return dispatchForPhase(feature, phase, home);
}

export function tickLoopForFeature(feature: FeatureRecord, home?: string) {
  const currentPhase = feature.loopPhase === 'idle' ? 'implementation' : feature.loopPhase;
  const tasks = listTasks(feature.id, home) as any[];
  const currentTask =
    tasks.find((task) => task.phase === currentPhase && task.status === 'running') ??
    tasks.find((task) => task.phase === currentPhase);

  if (currentTask && currentTask.status !== 'completed') {
    updateTaskStatus(currentTask.id, 'completed', { completedAt: now() }, home);
  }

  if (feature.currentRunId) {
    const db = openConfiguredCommandDb(home);
    db.prepare("update runs set status='succeeded', result_json=?, updated_at=? where id=?").run(
      JSON.stringify({ phase: currentPhase, completedAt: now() }),
      now(),
      feature.currentRunId
    );
    db.close();
  }

  completeActiveSessionsForFeature(feature.id, home, `phase_${currentPhase}_completed`);

  const next = nextPhase(currentPhase);

  if (next === 'done') {
    const db = openConfiguredCommandDb(home);

    db.prepare('update features set loop_phase=?, status=?, current_run_id=?, updated_at=? where id=?').run(
      'done',
      'completed',
      null,
      now(),
      feature.id
    );

    emitEvent(db, 'feature.completed', 'feature', feature.id, {});
    db.close();

    if (feature.currentWorkspaceId) {
      cleanupWorkspace(feature.currentWorkspaceId, home, 'feature_completed');
    }

    return { feature, run: null, task: null };
  }

  ensurePhaseTask(feature, next, home);
  return dispatchForPhase(feature, next, home);
}
