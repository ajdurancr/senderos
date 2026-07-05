import type { FeatureRecord, FeatureStatus, SenderoStep } from '../../../domain/types';
import { openRuntimeDb } from '../../../db/client';
import { now } from '../../../utils/common';
import { emitEvent } from '../../events';
import { completeActiveSessionsForFeature } from '../../session-lifecycle';
import { updateRunExecutionByRunId } from '../agents';
import { cleanupWorkspace, dispatchRunPhase } from './dispatch';
import { listTasks } from './queries';
import { ensurePhaseTask, updateTaskStatus } from './tasks';

const SENDERO_STEP_SEQUENCE: SenderoStep[] = ['implementation', 'review', 'mutation'];

function nextSenderoStep(current: SenderoStep): SenderoStep {
  if (current === 'idle') return 'implementation';
  const index = SENDERO_STEP_SEQUENCE.indexOf(current);
  if (index === -1 || index === SENDERO_STEP_SEQUENCE.length - 1) return 'done';
  return SENDERO_STEP_SEQUENCE[index + 1];
}

export function dispatchFeatureRun(
  feature: FeatureRecord,
  home?: string,
  options?: { agentId?: string; senderoId?: string }
) {
  const phase = feature.senderoStep === 'idle' ? 'implementation' : feature.senderoStep;
  return dispatchRunPhase(feature, phase, home, options);
}

export function dispatchNextFeatureRun(feature: FeatureRecord, home?: string) {
  const currentPhase = feature.senderoStep === 'idle' ? 'implementation' : feature.senderoStep;
  const tasks = listTasks(feature.id, home) as any[];
  const currentTask =
    tasks.find((task) => task.phase === currentPhase && task.status === 'running') ??
    tasks.find((task) => task.phase === currentPhase);

  if (currentTask && currentTask.status !== 'completed') {
    updateTaskStatus(currentTask.id, 'completed', { completedAt: now() }, home);
  }

  if (feature.currentRunId) {
    const db = openRuntimeDb(home);
    db.prepare("update runs set status='succeeded', result_json=?, updated_at=? where id=?").run(
      JSON.stringify({ phase: currentPhase, completedAt: now() }),
      now(),
      feature.currentRunId
    );
    db.close();

    updateRunExecutionByRunId(
      feature.currentRunId,
      {
        status: 'succeeded',
        checkpoint: `${currentPhase}:completed`,
        result: { phase: currentPhase, completedAt: now() },
        finishedAt: now(),
      },
      home
    );
  }

  completeActiveSessionsForFeature(feature.id, home, `phase_${currentPhase}_completed`);

  const next = nextSenderoStep(currentPhase);

  if (next === 'done') {
    const db = openRuntimeDb(home);

    db.prepare('update features set sendero_step=?, status=?, current_run_id=?, updated_at=? where id=?').run(
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

    return { feature, run: null, task: null, runExecution: null };
  }

  ensurePhaseTask(feature, next, home);
  return dispatchRunPhase(feature, next, home);
}
