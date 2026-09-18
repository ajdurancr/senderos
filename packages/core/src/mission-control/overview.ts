import { listGoals } from '../commands/goals/list';
import { listProjects } from '../commands/projects/list';
import { listRuns } from '../commands/runs/list';
import { listRunAttempts } from '../commands/attempts/list';
import { plan } from '../commands/planning/plan';
import { status } from '../commands/system/status';
import type { AttemptReview } from '../shared/types';

export async function missionControlOverview(home?: string, executionContextId?: string) {
  const goals = await listGoals(home, executionContextId);
  const runs = await listRuns(home, executionContextId);
  const attempts = await listRunAttempts(undefined, home, executionContextId);
  const reviews = attempts.flatMap((attempt) => {
    const snapshot: { review?: AttemptReview } = JSON.parse(attempt.statusSnapshotJson);
    return snapshot.review?.status === 'pending' ? [{ attempt, review: snapshot.review }] : [];
  });
  return {
    status: await status(home, executionContextId),
    projects: await listProjects(home, executionContextId),
    goals,
    runs,
    attempts,
    queue: {
      dispatchable: await plan({ home, executionContextId }),
      reviews,
      blockedGoals: goals.filter((goal) => goal.status === 'blocked'),
      failedAttempts: attempts.filter((attempt) => attempt.status === 'failed'),
      staleAttempts: attempts.filter((attempt) => attempt.status === 'running' && !attempt.heartbeatAt),
      activeRuns: runs.filter((run) => !['succeeded', 'failed', 'canceled'].includes(run.status)),
    },
  };
}
