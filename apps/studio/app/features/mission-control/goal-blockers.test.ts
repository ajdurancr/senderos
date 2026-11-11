import { describe, expect, it } from "vitest";
import { missionControlFixture as fixture } from "../../test-support/mission-control-fixture";
import { blockerGuidance, goalBlockers } from "./goal-blockers";
import { filterMissionControlData } from "./scope-filters";

const blocked = { goalId: "goal-1", activationId: "blocked-visit", nodeId: "node-agent", state: "blocked" as const, reason: "AGENT_UNAVAILABLE", nextAction: "Enable the activation agent or cancel the goal" };

describe("goal blockers", () => {
  it("includes blocked parallel activations when the primary decision is ready", () => {
    const ready = { ...blocked, activationId: "ready-visit", state: "ready" as const, reason: "next_step", nextAction: "dispatch" };
    const data = { ...fixture, goals: [{ ...fixture.goals[0]!, status: "active" as const }], decisions: [{ ...ready, activations: [ready, blocked] }] };
    expect(data.queue.blockedGoals).toHaveLength(0);
    expect(goalBlockers(data)).toEqual([{ goal: data.goals[0], blockers: [blocked] }]);
    expect(goalBlockers(filterMissionControlData(data, "unrelated-context"))).toEqual([]);
  });

  it("keeps every blocked visit in one goal record without duplicating its primary decision", () => {
    const second = { ...blocked, activationId: "second-visit", reason: "retry_limit_reached", nextAction: "increase_retry_budget" };
    expect(goalBlockers({ ...fixture, decisions: [{ ...blocked, activations: [blocked, second] }] })[0]?.blockers).toEqual([blocked, second]);
  });

  it.each(["draft", "completed", "canceled"] as const)("never presents historical blockers as attention for a %s goal", status => {
    expect(goalBlockers({ ...fixture, goals: [{ ...fixture.goals[0]!, status }], decisions: [{ ...blocked, activations: [blocked] }] })).toEqual([]);
  });

  it("uses a goal-level error if Core cannot explain individual activations", () => {
    const decision = { ...blocked, activationId: undefined, nodeId: undefined, reason: "INCONSISTENT_HISTORY", nextAction: "Inspect the recorded history", activations: [] };
    expect(goalBlockers({ ...fixture, decisions: [decision] })[0]?.blockers).toEqual([decision]);
    expect(blockerGuidance(decision)).toEqual({ title: "INCONSISTENT HISTORY", next: "Inspect the recorded history" });
  });

  it("does not invent a recovery action when the current decision is unavailable", () => {
    const data = { ...fixture, goals: [{ ...fixture.goals[0]!, status: "blocked" as const }] };
    const blocker = goalBlockers(data)[0]!.blockers[0]!;
    expect(blockerGuidance(blocker).next).toContain("No recovery action has been inferred");
    expect(goalBlockers({ ...data, decisions: [{ ...blocked, state: "running", activations: [] }] })).toEqual([]);
  });

  it.each(["AGENT_UNAVAILABLE", "retry_limit_reached", "activation_limit_reached", "lease_expired", "cancellation_requested", "waiting_for_join", "waiting_join", "waiting_for_review_or_resume"])("explains %s without implying execution or external side effects", reason => {
    const guidance = blockerGuidance({ ...blocked, reason });
    expect(guidance.title.length).toBeGreaterThan(5);
    expect(guidance.next.length).toBeGreaterThan(20);
  });
});

it("shows the same exact unmet completion facts in attention guidance", () => {
  expect(blockerGuidance({ ...blocked, reason: "completion_prerequisites", completion: { missingEvidenceKinds: ["test", "artifact"], missingReview: true } })).toEqual({ title: "Completion requested", next: "Record test report evidence. Record artifact evidence. Record an approved review." });
  for (const completion of [undefined, { missingEvidenceKinds: [], missingReview: false }]) expect(blockerGuidance({ ...blocked, reason: "completion_prerequisites", completion }).next).toContain("Completion has not been inferred");
});
