import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, expect, it, vi } from "vitest";
import { GoalBudgets } from "./goal-budgets";
import { missionControlFixture as fixture } from "../../../test-support/mission-control-fixture";
import type { MissionControlData } from "../server";

afterEach(cleanup);
const execution = { goalId: "goal-1", activationsUsed: 2, maxActivations: 3, maxAttempts: 2, cancellationRequestedAt: null } as MissionControlData["executions"][number];
function show(status = "active", record: typeof execution | undefined = execution, revalidate?: () => Promise<null>) {
  const action = vi.fn(async ({ request }: { request: Request }) => Object.fromEntries(await request.formData()));
  const goal = { ...fixture.goals[0]!, status } as MissionControlData["goals"][number];
  const data = { ...fixture, executions: record ? [record] : [] };
  const router = createMemoryRouter([{ id: "budgets", path: "*", element: <GoalBudgets data={data} goal={goal} />, action, ...(revalidate ? { loader: revalidate } : {}) }], revalidate ? { hydrationData: { loaderData: { budgets: null } } } : undefined);
  render(<RouterProvider router={router} />);
  return action;
}
it("shows actual usage and submits each limit independently", async () => {
  // Action completion is earlier than router revalidation completion. Hold that
  // boundary explicitly so this test cannot accidentally depend on a fast router.
  let finishRevalidation!: (value: null) => void;
  const revalidated = new Promise<null>(resolve => { finishRevalidation = resolve; });
  const revalidate = vi.fn(() => revalidated);
  const action = show("active", execution, revalidate);
  expect(screen.getByText("2 / 3")).toBeTruthy();
  const field = screen.getByRole("spinbutton", { name: "Activation limit" });
  expect(field.getAttribute("min")).toBe("2");
  fireEvent.change(field, { target: { value: "8" } });
  fireEvent.click(screen.getByRole("button", { name: "Save activation limit" }));
  await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
  expect(await action.mock.results[0]!.value).toEqual({ intent: "set-activation-budget", goalId: "goal-1", limit: "8" });
  await waitFor(() => expect(revalidate).toHaveBeenCalledOnce());
  await waitFor(() => expect(screen.getAllByRole("button", { name: "Saving…" })).toHaveLength(2));
  expect(screen.queryByRole("button", { name: "Save attempt limit" })).toBeNull();
  finishRevalidation(null);
  const next = await screen.findByRole("button", { name: "Save attempt limit" });
  expect(next).toHaveProperty("disabled", false);
  fireEvent.change(screen.getByRole("spinbutton", { name: "Attempt limit per activation" }), { target: { value: "4" } });
  fireEvent.click(next);
  await waitFor(() => expect(action).toHaveBeenCalledTimes(2));
  expect(await action.mock.results[1]!.value).toEqual({ intent: "set-retry-budget", goalId: "goal-1", limit: "4" });
  await screen.findByRole("button", { name: "Save attempt limit" });
});
it.each(["completed", "canceled"])("keeps %s budgets visible and read-only", status => {
  show(status); expect(screen.getByText("2 / 3")).toBeTruthy(); expect(screen.queryByRole("spinbutton")).toBeNull();
});
it("explains cancellation pending without allowing edits", () => {
  show("blocked", { ...execution, cancellationRequestedAt: "2026-11-10T12:00:00Z" });
  expect(screen.getByText(/awaits host acknowledgement/)).toBeTruthy(); expect(screen.queryByRole("button")).toBeNull();
});
it("explains an uninitialized draft without inventing limits", () => {
  show("draft", { ...execution, goalId: "other" }); expect(screen.getByText(/Start this goal/)).toBeTruthy(); expect(screen.queryByRole("spinbutton")).toBeNull();
});
it("reports missing active records instead of fabricating editable budgets", () => {
  show("active", { ...execution, goalId: "other" });
  expect(screen.getByText(/records are unavailable/)).toBeTruthy(); expect(screen.queryByRole("spinbutton")).toBeNull();
});
it("shows separate attempt usage for each branch and excludes other goals", () => {
  const goal = { ...fixture.goals[0]!, status: "active" } as MissionControlData["goals"][number];
  const activation = (id: string, goalId: string, nodeId: string, attemptsUsed: number) => ({ id, goalId, nodeId, attemptsUsed, maxAttempts: 3, status: "failed" }) as MissionControlData["activations"][number];
  const data = { ...fixture, executions: [execution], activations: [activation("a", goal.id, "node-a", 1), activation("b", goal.id, "node-b", 3), activation("foreign", "other", "private-node", 2)] };
  render(<RouterProvider router={createMemoryRouter([{ path: "*", element: <GoalBudgets data={data} goal={goal} /> }])} />);
  expect(screen.getByText("node-a: 1 / 3 attempts · failed")).toBeTruthy();
  expect(screen.getByText("node-b: 3 / 3 attempts · failed")).toBeTruthy();
  expect(screen.queryByText(/private-node/)).toBeNull();
});
it("disables both budget submissions while navigation is pending", async () => {
  let finish!: () => void;
  const completed = new Promise<void>(resolve => { finish = resolve; });
  const goal = { ...fixture.goals[0]!, status: "active" } as MissionControlData["goals"][number];
  const router = createMemoryRouter([{ path: "*", element: <GoalBudgets data={{ ...fixture, executions: [execution] }} goal={goal} />, action: () => completed }]);
  render(<RouterProvider router={router} />);
  fireEvent.click(screen.getByRole("button", { name: "Save activation limit" }));
  await waitFor(() => expect(screen.getAllByRole("button", { name: "Saving…" }).every(button => (button as HTMLButtonElement).disabled)).toBe(true));
  finish(); await waitFor(() => expect(screen.getByRole("button", { name: "Save activation limit" })).toHaveProperty("disabled", false));
});
