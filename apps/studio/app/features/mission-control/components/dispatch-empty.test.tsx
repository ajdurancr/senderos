import { cleanup, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, expect, it, vi } from "vitest";
import { DispatchTray } from "./dispatch-tray";
import { missionControlFixture as data } from "../../../test-support/mission-control-fixture";

afterEach(cleanup);
it("keeps an empty reviewed plan visible and dismissible without allowing a reservation", () => {
  const action = vi.fn(() => null);
  const { container } = render(<RouterProvider router={createMemoryRouter([{ path: "*", action, element: <DispatchTray data={{ ...data, queue: { ...data.queue, dispatchable: [] } }} scope={{ executionContextId: "context-1", projectId: "project-1" }} /> }], { initialEntries: ["/projects/project-1/canvas/goals/goal-1?plan=true&context=context-1&project=project-1"] })} />);
  expect(screen.getByRole("heading", { name: "No activations ready" })).toBeTruthy();
  expect(screen.getByText("0 proposed actions")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Dispatch all" })).toHaveProperty("disabled", true);
  expect(screen.getByRole("link", { name: "Close dispatch plan" }).getAttribute("href")).toBe("/projects/project-1/canvas/goals/goal-1?context=context-1&project=project-1");
  expect(container.querySelector<HTMLInputElement>('input[name="reviewedItems"]')?.value).toBe("[]");
  expect(container.querySelector<HTMLInputElement>('input[name="scope"]')?.value).toBe(JSON.stringify({ executionContextId: "context-1", projectId: "project-1" }));
  expect(action).not.toHaveBeenCalled();
});
