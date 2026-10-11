import type { GoalStatus } from "../../shared/types";
import { listGoals } from "../goals/list";
import { explainGoal } from "../../lifecycle/state";
export async function plan(input: { home?: string; goalStatuses?: GoalStatus[]; executionContextId?: string }) {
  const items: Array<{ goalId: string; activationId: string; transitionId: string; agentId: string; previousRunId: string | null; revision: number }> = [];
  for (const goal of await listGoals(input.home, input.executionContextId)) {
    if (!(input.goalStatuses?.length ? input.goalStatuses : ["active", "failed", "blocked"]).includes(goal.status)) continue;
    const next = await explainGoal(goal.id, input.home);
    for (const activation of next.activations) if (activation.state === "ready") items.push({ goalId: goal.id, activationId: activation.activationId!, transitionId: activation.transitionId!, agentId: activation.agentId!, previousRunId: activation.previousRunId ?? null, revision: activation.revision! });
  }
  return items;
}
