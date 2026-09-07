import { listRunAttempts } from '../attempts/list';
import { getGoal } from '../goals/get';
import { latestRunForGoal } from './latest-for-goal';
export async function showRunState(goalId: string, home?: string) {
  const goal = await getGoal(goalId, home);
  if (!goal) throw new Error(`Goal not found: ${goalId}`);
  const run: any = await latestRunForGoal(goalId, home);
  return { goal, run, attempts: run ? await listRunAttempts(run.id, home) : [] };
}
