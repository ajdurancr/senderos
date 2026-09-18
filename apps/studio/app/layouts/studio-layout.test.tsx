import { fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";

import { StudioLayout } from "./studio-layout";
import { parseStudioPath } from "../features/mission-control/navigation";
import { missionControlFixture } from "../test-support/mission-control-fixture";

const data = {
  ...missionControlFixture,
  goals: [], attempts: [], runs: [],
};

describe("StudioLayout", () => {
  it("renders navigation, pending state, and persists hierarchical filters", () => {
    const router = createMemoryRouter([{
      path: "*",
      element: <StudioLayout data={data} pending route={parseStudioPath("/goals")} search={new URLSearchParams()}><p>Content</p></StudioLayout>,
    }], { initialEntries: ["/goals"] });
    render(<RouterProvider router={router} />);
    expect(screen.getByText("Applying change…")).toBeTruthy();
    expect(screen.getByText("Content")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Execution context"), { target: { value: "context-1" } });
    expect(router.state.location.search).toContain("context=context-1");
  });

  it("renders the shared Senderos header", () => {
    const router = createMemoryRouter([{ path: "*", element: <StudioLayout data={data} pending={false} route={parseStudioPath("/senderos/sendero-1")} search={new URLSearchParams()}><span>Sendero</span></StudioLayout> }]);
    render(<RouterProvider router={router} />);
    expect(screen.getByText("Shared Senderos")).toBeTruthy();
    expect(screen.getAllByText("Database connected").length).toBeGreaterThan(0);
  });
});
