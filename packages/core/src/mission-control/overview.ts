import { listGoals } from '../commands/goals/list';
import { listProjects } from '../commands/projects/list';
import { listRuns } from '../commands/runs/list';
import { listRunAttempts } from '../commands/attempts/list';
import { plan } from '../commands/planning/plan';
import { status } from '../commands/system/status';
import type { AttemptReview } from '../shared/types';
import { goalActivations } from '../lifecycle/activations';
import { explainGoal } from '../lifecycle/state';

export async function missionControlOverview(home?: string, executionContextId?: string) {
  const goals = await listGoals(home, executionContextId);
  const runs = await listRuns(home, executionContextId);
  const attempts = await listRunAttempts(undefined, home, executionContextId);
  const decisions: Awaited<ReturnType<typeof explainGoal>>[] = [];
  for (const goal of goals) decisions.push(await explainGoal(goal.id, home));
  const reviews = attempts.flatMap((attempt) => {
    const snapshot: { review?: AttemptReview } = JSON.parse(attempt.statusSnapshotJson);
    return snapshot.review?.status === 'pending' ? [{ attempt, review: snapshot.review }] : [];
  });
  return {
    status: await status(home, executionContextId),
    projects: await listProjects(home, executionContextId),
    goals,
    activations: (await Promise.all(goals.map(goal => goalActivations(goal.id, home)))).flat(),
    runs,
    attempts,
    decisions,
    queue: {
      dispatchable: await plan({ home, executionContextId }),
      reviews,
      blockedGoals: goals.filter((goal) => goal.status === 'blocked'),
      failedAttempts: attempts.filter((attempt) => attempt.status === 'failed'),
      staleAttempts: attempts.filter((attempt) => decisions.some(d => d.attemptId === attempt.id && d.reason === 'lease_expired')),
      activeRuns: runs.filter((run) => !['succeeded', 'failed', 'canceled'].includes(run.status)),
    },
  };
}
