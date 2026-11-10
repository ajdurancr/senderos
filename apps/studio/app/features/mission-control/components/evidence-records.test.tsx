import { cleanup, render, screen, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { EvidenceRecords } from "./evidence-records";
import { ContextualInspector } from "./contextual-inspector";
import { RunsView } from "./workspace-views";
import { missionControlFixture as data, fixtureTimestamp } from "../../../test-support/mission-control-fixture";
import { parseAttemptSnapshot, type AttemptSnapshot } from "../model";

afterEach(cleanup);
const snapshot: AttemptSnapshot = {
  evidence: [{ id: "manual-proof", label: "Keyboard report", kind: "manual", url: "https://example.com/report?run=1", summary: "Keyboard and narrow layouts checked.", createdAt: fixtureTimestamp }, { id: "host-test", label: "Host test suite", kind: "test", summary: "42 checks passed." }],
  review: { status: "approved", rationale: "Required proof matches this exact attempt.", reviewer: "Studio operator", reviewedAt: fixtureTimestamp },
};
const asOf = Date.parse(fixtureTimestamp) + 120_000;
function inRouter(element: React.ReactNode) { return render(<RouterProvider router={createMemoryRouter([{ path: "*", element }])} />); }

describe("EvidenceRecords", () => {
  it("shows exact manual and host kinds, summary, timestamp, rationale and safe actionable URL", () => {
    render(<EvidenceRecords snapshot={snapshot} asOf={asOf} />);
    const link = screen.getByRole("link", { name: "Open evidence: Keyboard report" });
    expect(link.getAttribute("href")).toBe("https://example.com/report?run=1");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(screen.getByText("manual")).toBeTruthy();
    expect(screen.getByText("test")).toBeTruthy();
    expect(screen.getByText("Keyboard and narrow layouts checked.")).toBeTruthy();
    expect(screen.getByText("42 checks passed.")).toBeTruthy();
    expect(screen.getByText("2m ago")).toBeTruthy();
    const review = within(screen.getByRole("region", { name: "Recorded review" }));
    expect(review.getByText("approved")).toBeTruthy();
    expect(review.getByText(snapshot.review!.rationale!)).toBeTruthy();
    expect(review.getByText("Studio operator · 2m ago")).toBeTruthy();
  });

  it.each(["javascript:alert(1)", "data:text/html,<script>alert(1)</script>", "file:///private/report", "ftp://example.com/report", "//example.com/report", "/relative/report", "not a URL", ""])("keeps evidence content but suppresses unsafe or invalid link %s", url => {
    render(<EvidenceRecords snapshot={{ evidence: [{ id: "proof", label: "Evidence label", kind: "manual", url, summary: "Preserved proof description" }] }} />);
    expect(screen.getByText("Evidence label")).toBeTruthy();
    expect(screen.getByText("Preserved proof description")).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("allows HTTP evidence while escaping all labels, summaries, and rationales as text", () => {
    const malicious = '<img src=x onerror="alert(1)">';
    const { container } = render(<EvidenceRecords snapshot={{ evidence: [{ id: "proof", label: malicious, kind: "test", summary: malicious, url: "http://localhost:8000/report" }], review: { status: "rejected", rationale: malicious } }} />);
    expect(screen.getByRole("link", { name: `Open evidence: ${malicious}` }).getAttribute("href")).toBe("http://localhost:8000/report");
    expect(container.querySelector("img, script")).toBeNull();
    expect(screen.getByText("Reviewer not recorded")).toBeTruthy();
  });

  it("renders honest empty evidence and absent review states", () => {
    render(<EvidenceRecords snapshot={{}} />);
    expect(screen.getByText("No evidence recorded for this attempt.")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Recorded review" })).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it.each(["succeeded", "failed", "canceled"] as const)("keeps %s attempt proof and rationale visible but removes mutation controls", status => {
    const fixture = { ...data, asOf, attempts: [{ ...data.attempts[0]!, status, statusSnapshotJson: JSON.stringify(snapshot) }] };
    inRouter(<ContextualInspector data={fixture} goalId="goal-1" attemptId="attempt-1" />);
    expect(screen.getByText("This attempt is finished. Its evidence and review are read-only.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open evidence: Keyboard report" }).getAttribute("href")).toBe("https://example.com/report?run=1");
    expect(screen.getByText(snapshot.review!.rationale!)).toBeTruthy();
    for (const name of ["Record evidence", "Record decision", "Request stop"]) expect(screen.queryByRole("button", { name })).toBeNull();
    expect(screen.queryByRole("textbox", { name: "Evidence label" })).toBeNull();
    expect(screen.queryByRole("combobox", { name: "Review decision" })).toBeNull();
  });

  it("shows the same exact evidence and terminal rationale when inspecting from Runs or Reviews", () => {
    const fixture = { ...data, asOf, attempts: [{ ...data.attempts[0]!, statusSnapshotJson: JSON.stringify(snapshot) }] };
    inRouter(<RunsView data={fixture} attemptId="attempt-1" />);
    expect(screen.getByRole("link", { name: "Open evidence: Keyboard report" }).getAttribute("href")).toBe(snapshot.evidence![0]!.url);
    expect(screen.getByText(snapshot.review!.rationale!)).toBeTruthy();
    expect(screen.getByText("Studio operator · 2m ago")).toBeTruthy();
  });
});

it.each(["queued", "running", "succeeded", "failed", "canceled"] as const)("links the %s run detail to the exact goal and attempt for its owning project", status => {
  const fixture = { ...data, attempts: [{ ...data.attempts[0]!, status }] };
  const path = "/runs/attempts/attempt-1?context=context-1&project=old-project";
  render(<RouterProvider router={createMemoryRouter([{ path: "*", element: <RunsView data={fixture} attemptId="attempt-1" /> }], { initialEntries: [path] })} />);
  const terminal = ["succeeded", "failed", "canceled"].includes(status);
  expect(screen.getByRole("link", { name: terminal ? "Open execution" : "Review this attempt" }).getAttribute("href")).toBe("/projects/project-1/canvas/goals/goal-1/attempts/attempt-1?context=context-1&project=project-1");
  expect(screen.queryByRole("link", { name: terminal ? "Review this attempt" : "Open execution" })).toBeNull();
});


it("renders readable proof when malformed persisted optional metadata is normalized", () => {
  const parsed = parseAttemptSnapshot(JSON.stringify({ evidence: [{ id: "proof", label: "Retained evidence", kind: "manual", url: { href: "https://example.com" }, summary: { text: "invalid React child" }, createdAt: 12 }], review: { status: "approved", rationale: { text: "invalid React child" }, reviewer: ["operator"], reviewedAt: false } }));
  const { container } = render(<EvidenceRecords snapshot={parsed} asOf={asOf} />);
  expect(screen.getByText("Retained evidence")).toBeTruthy();
  expect(screen.getByText("approved")).toBeTruthy();
  expect(screen.getByText("Reviewer not recorded")).toBeTruthy();
  expect(screen.queryByRole("link")).toBeNull();
  expect(container.textContent).not.toContain("invalid React child");
});
