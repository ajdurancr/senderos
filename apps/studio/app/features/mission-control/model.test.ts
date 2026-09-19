import { describe, expect, it } from "vitest";

import { eventLabel, goalExecution, parseAttemptSnapshot, relativeTime } from "./model";
import { missionControlFixture } from "../../test-support/mission-control-fixture";

describe("mission-control model helpers", () => {
  it("parses snapshots defensively", () => {
    expect(parseAttemptSnapshot('{"review":{"status":"approved"}}')).toEqual({ review: { status: "approved" } });
    expect(parseAttemptSnapshot("not-json")).toEqual({});
  });

  it("formats every relative-time range and event labels", () => {
    const now = Date.parse("2026-09-17T12:00:00Z");
    expect(relativeTime(undefined, now)).toBe("Never");
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
