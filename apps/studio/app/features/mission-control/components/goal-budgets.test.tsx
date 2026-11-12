import { useState } from "react";
import { InspectorDraftBoundary } from "./inspector-draft-boundary";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GoalBudgets } from "./goal-budgets";
import { missionControlFixture as fixture } from "../../../test-support/mission-control-fixture";
import type { MissionControlData } from "../server";

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});
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

it('uses one boundary for simultaneous budget drafts and discards them independently', async () => {
  const goal = { ...fixture.goals[0]!, status: 'active' } as MissionControlData['goals'][number];
  const router = createMemoryRouter([{ path: '*', element: <InspectorDraftBoundary disabled={false}><GoalBudgets data={{ ...fixture, executions: [execution] }} goal={goal} /></InspectorDraftBoundary> }]);
  render(<RouterProvider router={router} />);
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Activation limit' }), { target: { value: '8' } });
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Attempt limit per activation' }), { target: { value: '7' } });
  await router.navigate('/other');
  await waitFor(() => expect(screen.getAllByRole('dialog')).toHaveLength(1));
  expect(router.state.location.pathname).toBe('/');
  fireEvent.click(screen.getByRole('button', { name: 'Stay here' }));
  fireEvent.click(screen.getByRole('button', { name: 'Discard activation limit draft' }));
  expect((screen.getByRole('spinbutton', { name: 'Activation limit' }) as HTMLInputElement).value).toBe('3');
  expect((screen.getByRole('spinbutton', { name: 'Attempt limit per activation' }) as HTMLInputElement).value).toBe('7');
  fireEvent.click(screen.getByRole('button', { name: 'Discard attempt limit draft' }));
  await router.navigate('/other');
  await waitFor(() => expect(router.state.location.pathname).toBe('/other'));
  expect(screen.queryByRole('dialog')).toBeNull();
});
it('freezes both budget fields, prevents repeated posts and retains failed input', async () => {
  let finish!: (value: unknown) => void;
  const action = vi.fn(() => new Promise(resolve => { finish = resolve; }));
  const goal = { ...fixture.goals[0]!, status: 'active' } as MissionControlData['goals'][number];
  render(<RouterProvider router={createMemoryRouter([{ path: '*', element: <GoalBudgets data={{ ...fixture, executions: [execution] }} goal={goal} />, action }])} />);
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Activation limit' }), { target: { value: '8' } });
  const form = screen.getByRole('form', { name: 'Change activation limit' });
  fireEvent.submit(form); fireEvent.submit(form);
  await waitFor(() => expect(action).toHaveBeenCalledOnce());
  expect(screen.getAllByRole('spinbutton').every(field => field.matches(':disabled'))).toBe(true);
  finish({ ok: false, intent: 'set-activation-budget' });
  await waitFor(() => expect(screen.getAllByRole('spinbutton').every(field => !field.matches(':disabled'))).toBe(true));
  expect((screen.getByRole('spinbutton', { name: 'Activation limit' }) as HTMLInputElement).value).toBe('8');
});
it('refreshes clean limits without replacing an independent draft and discards to the current persisted limit', () => {
  const goal = { ...fixture.goals[0]!, status: 'active' } as MissionControlData['goals'][number];
  function Refreshable() {
    const [record, setRecord] = useState(execution);
    return <><button onClick={() => setRecord({ ...record, maxActivations: 5, maxAttempts: 4 })}>Refresh limits</button><GoalBudgets data={{ ...fixture, executions: [record] }} goal={goal} /></>;
  }
  render(<RouterProvider router={createMemoryRouter([{ path: '*', element: <Refreshable /> }])} />);
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Attempt limit per activation' }), { target: { value: '7' } });
  fireEvent.click(screen.getByRole('button', { name: 'Refresh limits' }));
  expect((screen.getByRole('spinbutton', { name: 'Activation limit' }) as HTMLInputElement).value).toBe('5');
  expect((screen.getByRole('spinbutton', { name: 'Attempt limit per activation' }) as HTMLInputElement).value).toBe('7');
  fireEvent.click(screen.getByRole('button', { name: 'Discard attempt limit draft' }));
  expect((screen.getByRole('spinbutton', { name: 'Attempt limit per activation' }) as HTMLInputElement).value).toBe('4');
});

it.each([
  { first: 'activation', firstLabel: 'Activation limit', firstValue: '8', second: 'attempt', secondLabel: 'Attempt limit per activation', secondValue: '4', firstIntent: 'set-activation-budget', secondIntent: 'set-retry-budget' },
  { first: 'attempt', firstLabel: 'Attempt limit per activation', firstValue: '7', second: 'activation', secondLabel: 'Activation limit', secondValue: '9', firstIntent: 'set-retry-budget', secondIntent: 'set-activation-budget' },
])('preserves an independent $second edit at the revalidation enablement boundary', async ({ first, firstLabel, firstValue, second, secondLabel, secondValue, firstIntent, secondIntent }) => {
  let finishRevalidation!: (value: null) => void;
  const revalidated = new Promise<null>(resolve => { finishRevalidation = resolve; });
  const revalidate = vi.fn(() => revalidated);
  const action = show('active', execution, revalidate);
  fireEvent.change(screen.getByRole('spinbutton', { name: firstLabel }), { target: { value: firstValue } });
  fireEvent.click(screen.getByRole('button', { name: `Save ${first} limit` }));
  await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
  expect(await action.mock.results[0]!.value).toEqual({ intent: firstIntent, goalId: 'goal-1', limit: firstValue });
  await waitFor(() => expect(revalidate).toHaveBeenCalledOnce());
  await waitFor(() => expect(screen.getAllByRole('button', { name: 'Saving…' })).toHaveLength(2));
  // Observe the enabled DOM commit before passive effects settle, exercising
  // the input boundary without depending on runner speed.
  const field = screen.getByRole('spinbutton', { name: secondLabel }) as HTMLInputElement;
  let editedValue: string | undefined;
  const enabled = new Promise<void>(resolve => {
    const observer = new MutationObserver(() => {
      if (field.matches(':disabled')) return;
      observer.disconnect();
      fireEvent.change(field, { target: { value: secondValue } });
      editedValue = field.value;
      fireEvent.click(screen.getByRole('button', { name: `Save ${second} limit` }));
      resolve();
    });
    observer.observe(document.body, { subtree: true, attributes: true, childList: true });
  });
  finishRevalidation(null);
  await enabled;
  await waitFor(() => expect(action).toHaveBeenCalledTimes(2));
  expect(editedValue).toBe(secondValue);
  expect(await action.mock.results[1]!.value).toEqual({ intent: secondIntent, goalId: 'goal-1', limit: secondValue });
  await screen.findByRole('button', { name: `Save ${second} limit` });
});
