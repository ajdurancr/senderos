import type { MissionControlData } from "./server";
import { completionActions } from "./model";

type Decision = MissionControlData["decisions"][number];
type Blocker = Decision["activations"][number];

export function goalBlockers(data: MissionControlData) {
  return data.goals.flatMap(goal => {
    if (["draft", "completed", "canceled"].includes(goal.status)) return [];
    const decision = data.decisions.find(item => item.goalId === goal.id);
    const blockers: Blocker[] = decision?.activations.filter(item => item.state === "blocked") ?? [];
    if (!blockers.length && decision?.state === "blocked") blockers.push(decision);
    if (!decision && goal.status === "blocked") blockers.push({ goalId: goal.id, state: "blocked", reason: "unknown_blocker", nextAction: "inspect_goal" });
    return blockers.length ? [{ goal, blockers }] : [];
  });
}

export function blockerGuidance(blocker: Blocker) {
  if (blocker.reason === "completion_prerequisites") {
    const actions = blocker.completion ? completionActions(blocker.completion) : [];
    return { title: "Completion requested", next: actions.length ? actions.join(" ") : "Inspect this attempt's pinned completion prerequisites and refresh its status. Completion has not been inferred." };
  }
  const guidance: Record<string, { title: string; next: string }> = {
    AGENT_UNAVAILABLE: { title: "Agent unavailable", next: "Enable the activation's agent in Settings, or cancel the goal." },
    retry_limit_reached: { title: "Attempt budget reached", next: "Inspect the failed attempts before explicitly increasing the retry budget or canceling the goal." },
    activation_limit_reached: { title: "Activation budget reached", next: "Inspect the workflow before explicitly increasing the activation budget or canceling the goal." },
    lease_expired: { title: "Host lease expired", next: "The owning host must inspect and reconcile its actual session. An expired lease does not prove the process stopped." },
    cancellation_requested: { title: "Waiting for stop acknowledgements", next: "Every owning host must confirm its session stopped. Senderos does not terminate external processes." },
    waiting_for_join: { title: "Waiting for parallel branches", next: "Wait for outstanding branches; inspect any failures or missing host reports." },
    waiting_join: { title: "Waiting for parallel branches", next: "Wait for outstanding branches; inspect any failures or missing host reports." },
    waiting_for_review_or_resume: { title: "Attempt paused", next: "Inspect this attempt's evidence and review requirements. Any session recovery remains the owning host's responsibility." },
    unknown_blocker: { title: "Goal blocked", next: "Inspect the goal for its current lifecycle explanation. No recovery action has been inferred." },
  };
  return guidance[blocker.reason] ?? { title: blocker.reason.replaceAll("_", " "), next: blocker.nextAction.replaceAll("_", " ") };
}
