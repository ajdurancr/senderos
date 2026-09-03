import { getGoal } from '../commands/goals/get';
import { plan } from '../commands/planning/plan';
import { dispatchRun } from '../commands/runs/dispatch';
import { missionControlGoal } from './goal';

export function missionControlRetryExecution(input: {
  goalId: string;
  workingPath?: string;
  home?: string;
}) {
  const goal = getGoal(input.goalId, input.home);
  if (!goal) throw new Error(`Goal not found: ${input.goalId}`);
  const item = plan({ home: input.home, goalStatuses: ['failed'] }).find(
    (candidate) => candidate.goalId === goal.id,
  );
  if (!item) throw new Error(`Goal is not retryable: ${goal.id}`);
  dispatchRun(
    {
      ...item,
      previousRunId: item.previousRunId ?? undefined,
      workingPath: input.workingPath,
    },
    input.home,
  );
  return missionControlGoal({ goalId: goal.id, home: input.home });
}
