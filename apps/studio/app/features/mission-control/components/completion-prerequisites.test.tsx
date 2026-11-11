import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { createMemoryRouter, RouterProvider } from "react-router";
import { ContextualInspector } from "./contextual-inspector";
import { CompletionPrerequisites } from "./completion-prerequisites";
import { missionControlFixture as fixture } from "../../../test-support/mission-control-fixture";
import type { MissionControlData } from "../server";

afterEach(cleanup);
function data(): MissionControlData {
  const completion = { missingEvidenceKinds: ["test", "artifact"], missingReview: true };
  const activation = { goalId: "goal-1", activationId: "activation-1", attemptId: "attempt-1", state: "blocked" as const, reason: "completion_prerequisites", nextAction: "review_or_record_evidence", completion };
  return { ...fixture, goals: [{ ...fixture.goals[0]!, status: "active" }], attempts: [{ ...fixture.attempts[0]!, status: "paused", cancellationRequestedAt: null, statusSnapshotJson: '{"completionRequested":true}' }], decisions: [{ ...activation, activations: [activation] }] };
}
function inspector(value = data(), attemptId = "attempt-1") {
  return render(<RouterProvider router={createMemoryRouter([{ path: "*", element: <ContextualInspector data={value} goalId="goal-1" attemptId={attemptId} /> }])} />);
}
it("names each unmet prerequisite for the selected completion-pending attempt", () => {
  inspector();
  const region = within(screen.getByRole("region", { name: "Completion prerequisites" }));
  expect(region.getByText("Record test report evidence.")).toBeTruthy();
  expect(region.getByText("Record artifact evidence.")).toBeTruthy();
  expect(region.getByText("Record an approved review.")).toBeTruthy();
  expect(region.getAllByRole("listitem")).toHaveLength(3);
});
it("removes satisfied requirements rather than repeating the full policy", () => {
  const value = data();
  value.decisions[0]!.activations[0]!.completion = { missingEvidenceKinds: ["artifact"], missingReview: false };
  inspector(value);
  const region = within(screen.getByRole("region", { name: "Completion prerequisites" }));
  expect(region.getAllByRole("listitem")).toHaveLength(1);
  expect(region.queryByText("Record test report evidence.")).toBeNull();
  expect(region.queryByText("Record an approved review.")).toBeNull();
});
it.each(["running", "succeeded", "failed", "canceled"] as const)("does not present completion actions for a %s attempt", status => {
  const value = data(); value.attempts[0]!.status = status;
  inspector(value);
  expect(screen.queryByRole("region", { name: "Completion prerequisites" })).toBeNull();
});
it("distinguishes an ordinary execution pause from reported completion", () => {
  const value = data(); value.attempts[0]!.statusSnapshotJson = '{"completionRequested":"true"}';
  inspector(value);
  expect(screen.queryByRole("region", { name: "Completion prerequisites" })).toBeNull();
});
it("gives cancellation precedence over completion actions", () => {
  const value = data(); value.attempts[0]!.cancellationRequestedAt = "2026-11-10T00:00:00.000Z";
  inspector(value);
  expect(screen.queryByRole("region", { name: "Completion prerequisites" })).toBeNull();
});
it("does not borrow a different activation's requirements from the goal summary", () => {
  const value = data(); value.decisions[0]!.activations = [{ ...value.decisions[0]!.activations[0]!, attemptId: "other-attempt", activationId: "other-activation" }];
  inspector(value);
  expect(screen.queryByRole("region", { name: "Completion prerequisites" })).toBeNull();
});
it("does not claim completion when no unmet facts are available", () => {
  render(<CompletionPrerequisites completion={{ missingEvidenceKinds: [], missingReview: false }} />);
  expect(screen.getByText(/Refresh status before taking another action/)).toBeTruthy();
});
it("labels CI, pull-request, manual and unknown recorded kinds as text", () => {
  render(<CompletionPrerequisites completion={{ missingEvidenceKinds: ["ci", "pull_request", "manual", "unrecognized_kind"], missingReview: false }} />);
  for (const label of ["CI result", "pull request", "manual observation", "unrecognized kind"]) expect(screen.getByText(`Record ${label} evidence.`)).toBeTruthy();
});
