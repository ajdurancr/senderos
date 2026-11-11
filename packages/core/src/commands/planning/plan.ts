import type { GoalRecord, GoalStatus } from "../../shared/types";
import { listGoals } from "../goals/list";
import { explainGoal } from "../../lifecycle/state";

type Decision = Awaited<ReturnType<typeof explainGoal>>;
type PlanItem = { goalId: string; activationId: string; transitionId: string; agentId: string; previousRunId: string | null; revision: number };
const defaultStatuses: GoalStatus[] = ["active", "failed", "blocked"];
const eligibleStatuses = (statuses?: GoalStatus[]) => statuses?.length ? statuses : defaultStatuses;

/** Project an already-read lifecycle snapshot without explaining goals again. */
export function planFromDecisions(goals: Pick<GoalRecord, "id" | "status">[], decisions: Decision[], goalStatuses?: GoalStatus[]): PlanItem[] {
  const byGoal = new Map(decisions.map(decision => [decision.goalId, decision]));
  const items: PlanItem[] = [];
  for (const goal of goals) {
    if (!eligibleStatuses(goalStatuses).includes(goal.status)) continue;
    for (const activation of byGoal.get(goal.id)?.activations ?? []) if (activation.state === "ready") {
      items.push({ goalId: goal.id, activationId: activation.activationId!, transitionId: activation.transitionId!, agentId: activation.agentId!, previousRunId: activation.previousRunId ?? null, revision: activation.revision! });
    }
  }
  return items;
}

export async function plan(input: { home?: string; goalStatuses?: GoalStatus[]; executionContextId?: string }) {
  const goals = (await listGoals(input.home, input.executionContextId)).filter(goal => eligibleStatuses(input.goalStatuses).includes(goal.status));
  const decisions: Decision[] = [];
  for (const goal of goals) decisions.push(await explainGoal(goal.id, input.home));
  return planFromDecisions(goals, decisions, input.goalStatuses);
}
