import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ContextualInspector } from "./contextual-inspector";
import { missionControlFixture as fixture } from "../../../test-support/mission-control-fixture";

afterEach(cleanup);

function inspector(data = fixture) {
  const submit = vi.fn(async ({ request }: { request: Request }) => Object.fromEntries(await request.formData()));
  const router = createMemoryRouter([{ path: "*", element: <ContextualInspector data={data} goalId="goal-1" />, action: submit }]);
  render(<RouterProvider router={router} />);
  return submit;
}

describe("goal-wide cancellation", () => {
  it("can cancel an activated goal without a run and discards unconfirmed intent", async () => {
    const submit = inspector({ ...fixture, goals: [{ ...fixture.goals[0]!, status: "active" }], runs: [], attempts: [] });
    const trigger = screen.getByRole("button", { name: "Request stop" });
    fireEvent.click(trigger);
    expect(screen.getByRole("form", { name: "Confirm goal cancellation" })).toBeTruthy();
    expect(screen.getByText(/Cancel “Ship feature”/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Keep goal" }));
    expect(submit).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Confirm stop" })).toBeNull();
    expect(document.activeElement).toBe(trigger);
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "Confirm stop" }));
    await waitFor(() => expect(submit).toHaveBeenCalledOnce());
    expect(await submit.mock.results[0]!.value).toEqual({ intent: "cancel-goal", goalId: "goal-1" });
  });

  it("keeps goal cancellation available after the selected attempt finished", () => {
    inspector();
    fireEvent.click(screen.getByRole("button", { name: "Request stop" }));
    expect(screen.getByRole("button", { name: "Confirm stop" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Record evidence" })).toBeNull();
  });

  it("reports outstanding hosts from any branch instead of offering another cancellation", () => {
    inspector({ ...fixture, goals: [{ ...fixture.goals[0]!, status: "blocked" }], attempts: [
      { ...fixture.attempts[0]!, status: "running", cancellationRequestedAt: "2026-11-10T12:00:00.000Z" },
      { ...fixture.attempts[0]!, id: "historical", status: "succeeded" },
    ] });
    expect(screen.getByRole("button", { name: "Stop requested" })).toHaveProperty("disabled", true);
    expect(screen.getByText(/Waiting for every owning host/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Request stop" })).toBeNull();
  });

  it.each(["draft", "completed", "canceled"] as const)("does not offer cancellation of a %s goal", status => {
    inspector({ ...fixture, goals: [{ ...fixture.goals[0]!, status }] });
    expect(screen.queryByRole("region", { name: "Goal cancellation" })).toBeNull();
  });
});
