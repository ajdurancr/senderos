import { openRuntimeDb } from '../db/client';
import { now } from '../shared/ids';
import { emitEvent } from '../shared/events';
import {
  createRunAttempt,
  getAgentTransition,
  getRunAttempt,
  listRunAttempts,
  updateRunAttempt,
} from './agents';
import { cancelGoal, getGoal } from './goals';
import { createRunRecord, getRun, latestRunForGoal } from './runs';

export function showRunState(goalId: string, home?: string) {
  const goal = getGoal(goalId, home);
  if (!goal) throw new Error(`Goal not found: ${goalId}`);
  const run: any = latestRunForGoal(goalId, home);
  return { goal, run, attempts: run ? listRunAttempts(run.id, home) : [] };
}
export function listRuns(home?: string) {
  const db = openRuntimeDb(home);
  const rows = db.query('select * from runs order by created_at asc').all();
  db.close();
  return rows;
}
export function dispatchRun(
  input: {
    goalId: string;
    transitionId: string;
    agentId: string;
    previousRunId?: string;
    workingPath?: string;
  },
  home?: string,
) {
  const goal = getGoal(input.goalId, home);
  if (!goal) throw new Error(`Goal not found: ${input.goalId}`);
  if (!['active', 'failed'].includes(goal.status))
    throw new Error(`Goal is not dispatchable from status ${goal.status}`);
  const transition = getAgentTransition(input.transitionId, home);
  if (!transition || transition.status !== 'active')
    throw new Error(`Active agent transition not found: ${input.transitionId}`);
  if (transition.sourceAgentId !== input.agentId)
    throw new Error('Agent must match the transition source agent');
  const previous = input.previousRunId
    ? (getRun(input.previousRunId, home) as any)
    : null;
  if (
    input.previousRunId &&
    (!previous ||
      previous.goal_id !== goal.id ||
      !['failed', 'succeeded'].includes(previous.status))
  )
    throw new Error(
      'previous-run-id must reference a completed run for this goal',
    );
  const run: any = createRunRecord(goal, home);
  const priorAttempt = previous
    ? listRunAttempts(previous.id, home).at(-1)
    : null;
  const attempt = createRunAttempt({
    home,
    runId: run.id,
    attemptNumber: 1,
    agentId: input.agentId,
    transitionId: transition.id,
    executionObjective: transition.transitionObjective,
    harness: 'unknown',
    externalSessionId: null,
    resumeCommand: null,
    heartbeatAt: now(),
    hostEnvironmentName: 'external-host-agent',
    workingPath: input.workingPath ?? priorAttempt?.workingPath ?? null,
    workingPathMode: input.workingPath
      ? 'new'
      : priorAttempt?.workingPath
        ? 'reused'
        : null,
    retryFromAttemptId: priorAttempt?.id ?? null,
    checkpoint: 'dispatched',
    status: 'running',
    startedAt: now(),
    debugMeta: { previousRunId: input.previousRunId ?? null },
  });
  return {
    goalId: goal.id,
    previousRunId: input.previousRunId ?? null,
    runId: run.id,
    attemptId: attempt.id,
  };
}
export function cancelRun(id: string, home?: string) {
  const db = openRuntimeDb(home);
  const run: any = db.query('select * from runs where id=?').get(id);
  if (!run) {
    db.close();
    throw new Error(`Run not found: ${id}`);
  }
  db.prepare("update runs set status='canceled',updated_at=? where id=?").run(
    now(),
    id,
  );
  db.close();
  for (const attempt of listRunAttempts(id, home).filter((item) =>
    ['queued', 'running', 'paused'].includes(item.status),
  ))
    updateRunAttempt(
      attempt.id,
      {
        status: 'canceled',
        finishedAt: now(),
        failureSummary: 'Run canceled by Senderos.',
      },
      home,
    );
  emitEvent(openRuntimeDb(home), 'run.canceled', 'run', id, {});
  cancelGoal(run.goal_id, home);
  return getRun(id, home);
}
export function getAttempt(id: string, home?: string) {
  return getRunAttempt(id, home);
}
export function resumeAttempt(id: string, home?: string) {
  const attempt = getRunAttempt(id, home);
  if (!attempt) throw new Error(`Run attempt not found: ${id}`);
  return { attempt, resumeCommand: attempt.resumeCommand };
}
