import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, expect, it, vi } from "vitest";
import { ContextualInspector } from "./contextual-inspector";
import { missionControlFixture as fixture } from "../../../test-support/mission-control-fixture";

afterEach(cleanup);
function setup() {
  const action = vi.fn(() => ({ error: "Fixture rejection" }));
  const data = { ...fixture,
    runs: [...fixture.runs, { ...fixture.runs[0]!, id: "run-2" }],
    attempts: [
      { ...fixture.attempts[0]!, status: "running" as const, statusSnapshotJson: "{}" },
      { ...fixture.attempts[0]!, id: "attempt-2", runId: "run-2", status: "running" as const, statusSnapshotJson: "{}" },
    ],
  };
  function Selection() {
    const [id, select] = useState("attempt-1");
    const [revision, refresh] = useState(0);
    return <><button onClick={() => select("attempt-1")}>Select A</button><button onClick={() => select("attempt-2")}>Select B</button><button onClick={() => refresh(revision + 1)}>Refresh data</button><ContextualInspector data={{ ...data, asOf: data.asOf + revision }} goalId="goal-1" attemptId={id} /></>;
  }
  render(<RouterProvider router={createMemoryRouter([{ path: "*", element: <Selection />, action }])} />);
  return action;
}
function draft() {
  fireEvent.change(screen.getByLabelText("Evidence kind"), { target: { value: "test" } });
  fireEvent.change(screen.getByLabelText("Evidence label"), { target: { value: "A proof" } });
  fireEvent.change(screen.getByLabelText("Evidence URL (optional)"), { target: { value: "https://example.com/a" } });
  fireEvent.change(screen.getByLabelText("Evidence summary (optional)"), { target: { value: "A summary" } });
  fireEvent.change(screen.getByLabelText("Review decision"), { target: { value: "rejected" } });
  fireEvent.change(screen.getByLabelText("Decision rationale"), { target: { value: "A rationale" } });
}
it("does not transfer unsaved evidence or review decisions to another selected attempt", () => {
  const action = setup(); draft();
  fireEvent.click(screen.getByRole("button", { name: "Select B" }));
  expect((screen.getByLabelText("Evidence label") as HTMLInputElement).value).toBe("");
  expect((screen.getByLabelText("Evidence kind") as HTMLSelectElement).value).toBe("manual");
  for (const label of ["Evidence URL (optional)", "Evidence summary (optional)", "Decision rationale"]) expect((screen.getByLabelText(label) as HTMLInputElement).value).toBe("");
  expect((screen.getByLabelText("Review decision") as HTMLSelectElement).value).toBe("approved");
  expect(new FormData(screen.getByRole("button", { name: "Record evidence" }).closest("form")!).get("attemptId")).toBe("attempt-2");
  fireEvent.click(screen.getByRole("button", { name: "Select A" }));
  expect((screen.getByLabelText("Evidence label") as HTMLInputElement).value).toBe("");
  expect(action).not.toHaveBeenCalled();
});
it("preserves unsaved inputs when refreshing the same selected attempt", () => {
  setup(); draft();
  fireEvent.click(screen.getByRole("button", { name: "Refresh data" }));
  expect((screen.getByLabelText("Evidence label") as HTMLInputElement).value).toBe("A proof");
  expect((screen.getByLabelText("Evidence kind") as HTMLSelectElement).value).toBe("test");
  expect((screen.getByLabelText("Decision rationale") as HTMLInputElement).value).toBe("A rationale");
});
it("preserves both drafts after a rejected submission on the same attempt", async () => {
  const action = setup(); draft();
  fireEvent.submit(screen.getByRole("button", { name: "Record evidence" }).closest("form")!);
  await waitFor(() => expect(action).toHaveBeenCalledOnce());
  await waitFor(() => expect((screen.getByRole("button", { name: "Record evidence" }) as HTMLButtonElement).disabled).toBe(false));
  expect((screen.getByLabelText("Evidence label") as HTMLInputElement).value).toBe("A proof");
  expect((screen.getByLabelText("Evidence kind") as HTMLSelectElement).value).toBe("test");
  expect((screen.getByLabelText("Decision rationale") as HTMLInputElement).value).toBe("A rationale");
});
