import { listGoals } from '../commands/goals/list';
import { listProjects } from '../commands/projects/list';
import { listRuns } from '../commands/runs/list';
import { listRunAttempts } from '../commands/attempts/list';
import { plan } from '../commands/planning/plan';
import { status } from '../commands/system/status';

export async function missionControlOverview(home?: string) {
  const goals = await listGoals(home);
  const runs = await listRuns(home);
  const attempts = await listRunAttempts(undefined, home);
  const reviews = attempts.flatMap((attempt) => {
    const snapshot = JSON.parse(attempt.statusSnapshotJson) as Record<string, any>;
    return snapshot.review?.status === 'pending' ? [{ attempt, review: snapshot.review }] : [];
  });
  return {
    status: await status(home),
    projects: await listProjects(home),
    goals,
    runs,
    attempts,
    queue: {
      dispatchable: await plan({ home }),
      reviews,
      blockedGoals: goals.filter((goal) => goal.status === 'blocked'),
      failedAttempts: attempts.filter((attempt) => attempt.status === 'failed'),
      staleAttempts: attempts.filter((attempt) => attempt.status === 'running' && !attempt.heartbeatAt),
      activeRuns: runs.filter((run) => !['succeeded', 'failed', 'canceled'].includes(run.status)),
    },
  };
}
