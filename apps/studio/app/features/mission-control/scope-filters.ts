import type { missionControlOverview, listEvents } from '@senderos/core';

type ScopeData = Awaited<ReturnType<typeof missionControlOverview>> & { events: Awaited<ReturnType<typeof listEvents>> };

export function filterMissionControlData<T extends ScopeData>(data: T, executionContextId?: string, projectId?: string): T {
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
  const visibleIds = new Set([...projectIds, ...goalIds, ...runIds, ...attemptIds, ...(data.activations ?? []).filter(activation => goalIds.has(activation.goalId)).map(activation => activation.id)]);
  const activeGoalIds = data.status.activeGoalIds.filter(id => goalIds.has(id));
  const runningRunIds = data.status.runningRunIds.filter(id => runIds.has(id));
  return { ...data, projects, goals, runs, attempts,
    executions: data.executions.filter(execution => goalIds.has(execution.goalId)),
    status: { ...data.status,
      projects: { total: projects.length, unhealthy: projects.filter(project => project.status !== 'healthy').length },
      openGoals: activeGoalIds.length, activeGoalIds,
      activeRuns: runningRunIds.length, runningRunIds,
      activeAttemptIds: data.status.activeAttemptIds.filter(id => attemptIds.has(id)),
    },
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
