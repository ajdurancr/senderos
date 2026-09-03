import { activateGoal } from '../commands/goals/activate';
import { plan } from '../commands/planning/plan';
import { dispatchRun } from '../commands/runs/dispatch';
import { missionControlGoal } from './goal';

export function missionControlStartGoal(input: {
  goalId: string;
  workingPath?: string;
  home?: string;
}) {
  const goal = activateGoal(input.goalId, input.home);
  if (!goal) throw new Error(`Goal not found: ${input.goalId}`);
  const item = plan({ home: input.home, goalStatuses: ['active'] }).find(
    (candidate) => candidate.goalId === goal.id,
  );
  if (!item)
    throw new Error(`No dispatchable transition found for goal: ${goal.id}`);
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
