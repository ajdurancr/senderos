import { nextPhase } from '../../domain/constants';
import type { FeatureRecord } from '../../domain/types';
import { openConfiguredCommandDb } from '../../db/client';
import { now } from '../../utils/common';
import { emitEvent } from '../events';
import { cleanupWorkspace, dispatchForPhase } from './dispatch';
import { listTasks } from './queries';
import { ensurePhaseTask, updateTaskStatus } from './tasks';

function completeActiveSessionsForFeature(featureId: string, home?: string, reason = 'phase_completed') {
  const db = openConfiguredCommandDb(home);
  const sessions = db
    .query(
      "select sessions.id from sessions join runs on runs.id = sessions.run_id where runs.feature_id = ? and sessions.status = 'active'"
    )
    .all(featureId) as Array<{ id: string }>;

  for (const session of sessions) {
    db.prepare("update sessions set status='completed', updated_at=? where id=?").run(now(), session.id);
    emitEvent(db, 'session.completed', 'session', session.id, { reason });
  }

  db.close();
}

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
