import { describe, expect, it } from "vitest";

import { eventLabel, goalExecution, parseAttemptSnapshot, relativeTime } from "./model";
import { missionControlFixture } from "../../test-support/mission-control-fixture";

describe("mission-control model helpers", () => {
  it("parses snapshots defensively", () => {
    expect(parseAttemptSnapshot('{"review":{"status":"approved"}}')).toEqual({ review: { status: "approved" } });
    expect(parseAttemptSnapshot("not-json")).toEqual({});
    expect(parseAttemptSnapshot("null")).toEqual({});
    expect(parseAttemptSnapshot("[]")).toEqual({});
    expect(parseAttemptSnapshot('{"evidence":[null,{"id":"bad"}],"review":"invalid"}')).toEqual({ evidence: [], review: undefined });
  });

  it("formats every relative-time range and event labels", () => {
    const now = Date.parse("2026-09-17T12:00:00Z");
    expect(relativeTime(undefined, now)).toBe("Never");
    expect(relativeTime("not-a-date", now)).toBe("Unknown");
    expect(relativeTime("2026-09-17T11:59:30Z", now)).toBe("30s ago");
    expect(relativeTime("2026-09-17T11:30:00Z", now)).toBe("30m ago");
    expect(relativeTime("2026-09-17T09:00:00Z", now)).toBe("3h ago");
    expect(relativeTime("2026-09-15T12:00:00Z", now)).toBe("2d ago");
    expect(eventLabel("goal.review-requested")).toBe("goal / review requested");
  });

  it("orders a goal's runs and attempts and returns the latest records", () => {
    const data = {
      ...missionControlFixture,
      runs: [
        { ...missionControlFixture.runs[0]!, id: "run-2", goalId: "goal", createdAt: "2026-02-02" },
        { ...missionControlFixture.runs[0]!, id: "run-1", goalId: "goal", createdAt: "2026-02-01" },
        { ...missionControlFixture.runs[0]!, id: "other", goalId: "other", createdAt: "2026-02-03" },
      ],
      attempts: [
        { ...missionControlFixture.attempts[0]!, id: "a2", runId: "run-2", attemptNumber: 2 },
        { ...missionControlFixture.attempts[0]!, id: "a1", runId: "run-1", attemptNumber: 1 },
      ],
    };
    expect(goalExecution(data, "goal")).toMatchObject({
      runs: [{ id: "run-1" }, { id: "run-2" }],
      attempts: [{ id: "a1" }, { id: "a2" }],
      latestRun: { id: "run-2" },
      latestAttempt: { id: "a2" },
    });
  });
});

it("normalizes malformed optional evidence and review metadata before it reaches React", () => {
  const snapshot = parseAttemptSnapshot(JSON.stringify({
    evidence: [{ id: "proof", label: "Retained evidence", kind: "manual", url: { href: "https://example.com" }, summary: { text: "invalid child" }, createdAt: 12 }],
    review: { status: "approved", rationale: { text: "invalid child" }, reviewer: ["operator"], reviewedAt: false },
  }));
  expect(snapshot.evidence).toHaveLength(1);
  expect(snapshot.evidence![0]).toMatchObject({ id: "proof", label: "Retained evidence", kind: "manual" });
  for (const field of ["url", "summary", "createdAt"] as const) expect(snapshot.evidence![0]![field]).toBeUndefined();
  expect(snapshot.review?.status).toBe("approved");
  for (const field of ["rationale", "reviewer", "reviewedAt"] as const) expect(snapshot.review?.[field]).toBeUndefined();
});

it("retains valid optional metadata while discarding malformed entries and review status", () => {
  const evidence = { id: "proof", label: "Evidence", kind: "test", url: "https://example.com/report", summary: "All checks passed", createdAt: "2026-09-17T12:00:00Z" };
  expect(parseAttemptSnapshot(JSON.stringify({ evidence: [null, "bad", { id: 5, label: "bad", kind: "manual" }, evidence], review: { status: { label: "approved" } } }))).toEqual({ evidence: [evidence], review: undefined });
  const review = { status: "changes_requested", rationale: "Needs keyboard proof", reviewer: "Studio operator", reviewedAt: "2026-09-17T12:00:00Z" };
  expect(parseAttemptSnapshot(JSON.stringify({ review })).review).toEqual(review);
});
