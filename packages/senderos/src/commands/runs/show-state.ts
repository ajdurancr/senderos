import { listRunAttempts } from '../attempts/list';
import { getGoal } from '../goals/get';
import { latestRunForGoal } from './latest-for-goal';
export function showRunState(goalId: string, home?: string) {
  const goal = getGoal(goalId, home);
  if (!goal) throw new Error(`Goal not found: ${goalId}`);
  const run: any = latestRunForGoal(goalId, home);
  return { goal, run, attempts: run ? listRunAttempts(run.id, home) : [] };
}
