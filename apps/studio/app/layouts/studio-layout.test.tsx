import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it } from "vitest";

import { StudioLayout } from "./studio-layout";
import { parseStudioPath } from "../features/mission-control/navigation";
import { missionControlFixture } from "../test-support/mission-control-fixture";

const data = {
  ...missionControlFixture,
  goals: [], attempts: [], runs: [],
};

describe("StudioLayout", () => {
  afterEach(cleanup);
  it("renders navigation, pending state, and persists hierarchical filters", () => {
    const router = createMemoryRouter([{
      path: "*",
      element: <StudioLayout data={data} pending route={parseStudioPath("/goals")} search={new URLSearchParams()}><p>Content</p></StudioLayout>,
    }], { initialEntries: ["/goals"] });
    render(<RouterProvider router={router} />);
    expect(screen.getByText("Applying change…")).toBeTruthy();
    expect(screen.getByText("Content")).toBeTruthy();
    const navigation = within(screen.getByRole("navigation", { name: "Studio navigation" }));
    for (const label of ["Now", "Canvas", "Goals", "Runs", "Reviews", "Agents", "Senderos", "Events", "Settings"]) {
      const link = navigation.getByRole("link", { name: label });
      expect(link.getAttribute("title")).toBe(label);
      expect(link.querySelector("span")?.textContent).toBe(label);
    }
    expect(navigation.getByRole("link", { name: "Goals" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "New goal" }).className).toBe("new-goal-button");
    fireEvent.change(screen.getByLabelText("Execution context"), { target: { value: "context-1" } });
    expect(router.state.location.search).toContain("context=context-1");
  });

  it("keeps management navigation explicitly labelled when its visual labels collapse", () => {
    const router = createMemoryRouter([{ path: "*", element: <StudioLayout data={data} pending={false} route={parseStudioPath("/settings")} search={new URLSearchParams()}><span>Settings content</span></StudioLayout> }], { initialEntries: ["/settings"] });
    render(<RouterProvider router={router} />);
    const navigation = within(screen.getByRole("navigation", { name: "Studio navigation" }));
    expect(navigation.getByRole("link", { name: "Settings" }).getAttribute("aria-current")).toBe("page");
    expect(navigation.getByRole("link", { name: "Agents" }).getAttribute("href")).toBe("/agents");
    expect(navigation.getByRole("link", { name: "Senderos" }).getAttribute("href")).toContain("/senderos/");
  });

  it("renders the shared Senderos header", () => {
    const router = createMemoryRouter([{ path: "*", element: <StudioLayout data={data} pending={false} route={parseStudioPath("/senderos/sendero-1")} search={new URLSearchParams()}><span>Sendero</span></StudioLayout> }]);
    render(<RouterProvider router={router} />);
    expect(screen.getByText("Shared Senderos")).toBeTruthy();
    expect(screen.getAllByText("Database connected").length).toBeGreaterThan(0);
  });
});
