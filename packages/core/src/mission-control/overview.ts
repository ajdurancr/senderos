import { listGoals } from '../commands/goals/list';
import { listProjects } from '../commands/projects/list';
import { listRuns } from '../commands/runs/list';
import { listRunAttempts } from '../commands/attempts/list';
import { plan } from '../commands/planning/plan';
import { status } from '../commands/system/status';

export function missionControlOverview(home?: string) {
  const goals = listGoals(home);
  const runs = listRuns(home);
  const attempts = listRunAttempts(undefined, home);
  const reviews = attempts.flatMap((attempt) => {
    const snapshot = JSON.parse(attempt.statusSnapshotJson) as Record<string, any>;
    return snapshot.review?.status === 'pending' ? [{ attempt, review: snapshot.review }] : [];
  });
  return {
    status: status(home),
    projects: listProjects(home),
    goals,
    runs,
    attempts,
    queue: {
      dispatchable: plan({ home }),
      reviews,
      blockedGoals: goals.filter((goal) => goal.status === 'blocked'),
      failedAttempts: attempts.filter((attempt) => attempt.status === 'failed'),
      staleAttempts: attempts.filter((attempt) => attempt.status === 'running' && !attempt.heartbeatAt),
      activeRuns: runs.filter((run) => !['succeeded', 'failed', 'canceled'].includes(run.status)),
    },
  };
}
