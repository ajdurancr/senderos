import { inArray } from 'drizzle-orm';
import { openRuntimeDb } from '../db/client';
import { goalExecutions } from '../db/schema';
import { listGoals } from '../commands/goals/list';
import { listProjects } from '../commands/projects/list';
import { listRuns } from '../commands/runs/list';
import { listRunAttempts } from '../commands/attempts/list';
import { planFromDecisions } from '../commands/planning/plan';
import { status, statusFromRecords } from '../commands/system/status';
import type { AttemptReview } from '../shared/types';
import { goalActivations, settledActivation } from '../lifecycle/activations';
import { explainGoal } from '../lifecycle/state';

export async function missionControlOverview(home?: string, executionContextId?: string, projectId?: string) {
  const projects = (await listProjects(home, executionContextId)).filter(project => !projectId || project.id === projectId);
  const projectIds = new Set(projects.map(project => project.id));
  const goals = (await listGoals(home, executionContextId, projectId)).filter(goal => !projectId || projectIds.has(goal.projectId));
  const goalIds = new Set(goals.map(goal => goal.id));
  const runs = (await listRuns(home, executionContextId, projectId)).filter(run => !projectId || goalIds.has(run.goalId));
  const runIds = new Set(runs.map(run => run.id));
  // Keep existing context host inspection semantics for complete overviews. An
  // explicit project narrows operational records to that project's runs.
  const attempts = (await listRunAttempts(undefined, home, executionContextId, projectId)).filter(attempt => !projectId || runIds.has(attempt.runId));
  const decisions: Awaited<ReturnType<typeof explainGoal>>[] = [];
  for (const goal of goals) decisions.push(await explainGoal(goal.id, home));
  const activations = (await Promise.all(goals.map(goal => goalActivations(goal.id, home)))).flat();
  const activationById = new Map(activations.map(item => [item.id, item]));
  const activationByRun = new Map(activations.filter(item => item.latestRunId).map(item => [item.latestRunId!, item]));
  const runById = new Map(runs.map(item => [item.id, item]));
  const goalById = new Map(goals.map(item => [item.id, item]));
  const attemptById = new Map(attempts.map(item => [item.id, item]));
  const supersededAttempts = new Set(attempts.flatMap(attempt => {
    const previous = attempt.retryFromAttemptId && attemptById.get(attempt.retryFromAttemptId);
    const run = runById.get(attempt.runId);
    return previous && run && run.goalId === runById.get(previous.runId)?.goalId ? [previous.id] : [];
  }));
  const latestAttemptByRun = new Map<string, typeof attempts[number]>();
  for (const attempt of attempts) {
    const latest = latestAttemptByRun.get(attempt.runId);
    if (!latest || latest.attemptNumber < attempt.attemptNumber) latestAttemptByRun.set(attempt.runId, attempt);
  }
  const failedAttempts = attempts.filter(attempt => {
    if (attempt.status !== 'failed' || supersededAttempts.has(attempt.id) || latestAttemptByRun.get(attempt.runId)?.id !== attempt.id) return false;
    const run = runById.get(attempt.runId);
    const goal = run && goalById.get(run.goalId);
    if (goal && ['completed', 'canceled'].includes(goal.status)) return false;
    const activation = run?.activationId ? activationById.get(run.activationId) : activationByRun.get(attempt.runId);
    // Keep unexplained history visible; only authoritative lifecycle state can
    // establish that a failure was superseded or settled. Parallel visits are independent.
    return !activation || (!settledActivation(activation.status) && activation.latestRunId === attempt.runId);
  });
  const reviews = attempts.flatMap((attempt) => {
    const snapshot: { review?: AttemptReview } = JSON.parse(attempt.statusSnapshotJson);
    return snapshot.review?.status === 'pending' ? [{ attempt, review: snapshot.review }] : [];
  });
  return {
    status: projectId ? statusFromRecords(projects, goals, runs, attempts) : await status(home, executionContextId),
    projects,
    goals,
    executions: goals.length ? await openRuntimeDb(home).select().from(goalExecutions).where(inArray(goalExecutions.goalId, goals.map(goal => goal.id))) : [],
    activations,
    runs,
    attempts,
    decisions,
    queue: {
      dispatchable: planFromDecisions(goals, decisions),
      reviews,
      blockedGoals: goals.filter((goal) => goal.status === 'blocked'),
      failedAttempts,
      staleAttempts: attempts.filter((attempt) => decisions.some(d => d.attemptId === attempt.id && d.reason === 'lease_expired')),
      activeRuns: runs.filter((run) => !['succeeded', 'failed', 'canceled'].includes(run.status)),
    },
  };
}
