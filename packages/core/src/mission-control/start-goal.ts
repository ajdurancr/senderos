import { atomic } from "../db/client";
import { explainGoal } from "../lifecycle/state";
import { activateGoal } from '../commands/goals/activate';
import { plan } from '../commands/planning/plan';
import { dispatchRun } from '../commands/runs/dispatch';
import { missionControlGoal } from './goal';

export async function missionControlStartGoal(input: {
  goalId: string;
  workingPath?: string;
  home?: string;
}) {
  return atomic(input.home, async () => {
  const decision = await explainGoal(input.goalId, input.home);
  if (decision.state === "running" || decision.state === "completed") return missionControlGoal(input);
  const goal = await activateGoal(input.goalId, input.home);
  if (!goal) throw new Error(`Goal not found: ${input.goalId}`);
  const item = (await plan({ home: input.home, goalStatuses: ['active'] })).find(
    (candidate) => candidate.goalId === goal.id,
  );
  if (!item)
    throw new Error(`No dispatchable transition found for goal: ${goal.id}`);
  await dispatchRun(
    {
      ...item,
      previousRunId: item.previousRunId ?? undefined,
      workingPath: input.workingPath,
    },
    input.home,
  );
  return missionControlGoal({ goalId: goal.id, home: input.home });
  });
}
