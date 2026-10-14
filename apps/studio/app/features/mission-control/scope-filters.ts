import type { MissionControlData } from './server';

export function filterMissionControlData(data: MissionControlData, executionContextId?: string, projectId?: string): MissionControlData {
  if (!executionContextId && !projectId) return data;
  const projects = data.projects.filter((project) =>
    (!executionContextId || project.executionContextId === executionContextId) &&
    (!projectId || project.id === projectId));
  const projectIds = new Set(projects.map((project) => project.id));
  const goals = data.goals.filter((goal) => projectIds.has(goal.projectId));
  const goalIds = new Set(goals.map((goal) => goal.id));
  const runs = data.runs.filter((run) => goalIds.has(run.goalId));
  const runIds = new Set(runs.map((run) => run.id));
  const attempts = data.attempts.filter((attempt) => runIds.has(attempt.runId));
  const attemptIds = new Set(attempts.map((attempt) => attempt.id));
  const visibleIds = new Set([...projectIds, ...goalIds, ...runIds, ...attemptIds]);
  return { ...data, projects, goals, runs, attempts,
    decisions: data.decisions?.filter(decision => goalIds.has(decision.goalId)),
    ...("activations" in data && Array.isArray(data.activations) ? { activations: data.activations.filter((activation: { goalId: string }) => goalIds.has(activation.goalId)) } : {}),
    events: data.events.filter((event) => visibleIds.has(event.entityId)),
    queue: { ...data.queue,
      blockedGoals: data.queue.blockedGoals.filter(goal => goalIds.has(goal.id)),
      activeRuns: data.queue.activeRuns.filter((run) => runIds.has(run.id)),
      failedAttempts: data.queue.failedAttempts.filter((attempt) => attemptIds.has(attempt.id)),
      staleAttempts: data.queue.staleAttempts.filter((attempt) => attemptIds.has(attempt.id)),
      reviews: data.queue.reviews.filter((item) => attemptIds.has(item.attempt.id)),
      dispatchable: data.queue.dispatchable.filter((item) => goalIds.has(item.goalId)),
    },
  };
}
