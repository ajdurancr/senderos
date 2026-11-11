import { cleanup, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, expect, it } from "vitest";
import { missionControlFixture as fixture } from "../../../test-support/mission-control-fixture";
import { ReviewsView } from "./workspace-views";

afterEach(cleanup);
const asOf = Date.parse("2026-11-10T12:00:00.000Z");
function reviews(snapshot: unknown, updatedAt = "2026-11-03T12:00:00.000Z") {
  const data = { ...fixture, asOf, attempts: [{ ...fixture.attempts[0]!, updatedAt, statusSnapshotJson: JSON.stringify(snapshot) }] };
  return render(<RouterProvider router={createMemoryRouter([{ path: "*", element: <ReviewsView data={data} /> }])} />);
}
it("dates newly recorded evidence from the proof rather than the old execution update", () => {
  reviews({ evidence: [{ id: "proof", label: "Fresh result", kind: "test", createdAt: "2026-11-10T11:59:00.000Z" }], review: { status: "pending" } });
  expect(screen.getByText(/Evidence added/).textContent).toBe("Evidence added 1m ago");
  expect(screen.getByText("1m ago").getAttribute("datetime")).toBe("2026-11-10T11:59:00.000Z");
  expect(screen.queryByText("7d ago")).toBeNull();
});
it("uses the newest evidence time even when imported proof is out of order", () => {
  reviews({ evidence: [
    { id: "new", label: "New result", kind: "test", createdAt: "2026-11-10T11:58:00Z" },
    { id: "old", label: "Older result", kind: "test", createdAt: "2026-11-01T12:00:00Z" },
  ], review: { status: "approved", reviewedAt: "2026-11-09T12:00:00Z" } });
  expect(screen.getByText(/Evidence added/).textContent).toBe("Evidence added 2m ago");
});
it("identifies a later review decision without claiming it is evidence creation", () => {
  reviews({ evidence: [{ id: "proof", label: "Result", kind: "test", createdAt: "2026-11-09T12:00:00Z" }], review: { status: "changes_requested", reviewedAt: "2026-11-10T11:57:00Z" } });
  expect(screen.getByText(/Review recorded/).textContent).toBe("Review recorded 3m ago");
});
it("labels the attempt update as a fallback for legacy undated proof", () => {
  reviews({ evidence: [{ id: "proof", label: "Legacy result", kind: "manual" }], review: { status: "pending" } });
  expect(screen.getByText(/Attempt updated/).textContent).toBe("Attempt updated 7d ago");
});
it("ignores malformed proof dates instead of hiding the valid review time", () => {
  reviews({ evidence: [{ id: "proof", label: "Imported result", kind: "manual", createdAt: "invalid" }], review: { status: "approved", reviewedAt: "2026-11-10T11:59:30Z" } });
  expect(screen.getByText(/Review recorded/).textContent).toBe("Review recorded 30s ago");
});
it("does not fabricate an age when every available timestamp is invalid", () => {
  reviews({ review: { status: "pending", reviewedAt: "invalid" } }, "invalid");
  expect(screen.getByText("Time unavailable")).toBeTruthy();
  expect(document.querySelector("time")).toBeNull();
});
