import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { missionControlFixture as data } from "../../../test-support/mission-control-fixture";
import { CommandPalette } from "./command-palette";
import { AgentsView, EventsView, GoalsView, ReviewsView } from "./workspace-views";

afterEach(cleanup);
function inRouter(element: React.ReactNode, path = "/goals") {
  const router = createMemoryRouter([{ path: "*", action: () => null, element }], { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

describe("workspace navigation", () => {
  it("keeps agents and Senderos searchable from the keyboard command palette", () => {
    inRouter(<CommandPalette data={data} />);
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    const input = screen.getByPlaceholderText("Find a goal, attempt, or action…");
    fireEvent.change(input, { target: { value: "agents" } });
    expect(screen.getByRole("link", { name: /Manage agents/ }).getAttribute("href")).toBe("/agents");
    fireEvent.change(input, { target: { value: "Senderos" } });
    expect(screen.getByRole("link", { name: /Manage Senderos/ }).getAttribute("href")).toBe("/senderos/sendero-1");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("traps modal focus, labels controls, and restores the trigger on dismissal", () => {
    inRouter(<><button>Outside action</button><CommandPalette data={data} /></>);
    const trigger = screen.getByRole("button", { name: "Search or run a command" });
    fireEvent.click(trigger);
    const input = screen.getByRole("textbox", { name: "Search commands" });
    expect(document.activeElement).toBe(input);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    const results = screen.getAllByRole("link");
    const last = results[results.length - 1]!;
    fireEvent.keyDown(input, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
    fireEvent.keyDown(last, { key: "Tab" });
    expect(document.activeElement).toBe(input);
    screen.getByRole("button", { name: "Outside action" }).focus();
    expect(document.activeElement).toBe(input);
    fireEvent.change(input, { target: { value: "no-matches-at-all" } });
    fireEvent.keyDown(input, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Esc" }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Search commands" }));
    fireEvent.click(screen.getByRole("button", { name: "Esc" }));
    expect(document.activeElement).toBe(trigger);
    fireEvent.click(trigger);
    fireEvent.mouseDown(screen.getByRole("dialog").parentElement!);
    expect(document.activeElement).toBe(trigger);
  });

  it("offers creation from all projects and asks for the owning project", () => {
    inRouter(<GoalsView data={data} create={false} />);
    expect(screen.getByRole("link", { name: "New goal" }).getAttribute("href")).toBe("/goals/new");
    cleanup();
    inRouter(<GoalsView data={data} create />, "/goals/new");
    expect(screen.getByRole("heading", { name: "Choose a project" })).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Choose a project" })).getByRole("link", { name: /Project One/ }).getAttribute("href")).toBe("/projects/project-1/goals/new");
    expect(screen.getByRole("link", { name: "Cancel" }).getAttribute("href")).toBe("/goals");
    expect(screen.queryByRole("button", { name: "Create goal" })).toBeNull();
  });

  it("limits project choices to the selected context and preserves cancel scope", () => {
    inRouter(<GoalsView data={{ ...data, projects: [...data.projects, { ...data.projects[0]!, id: "other", executionContextId: "other", name: "Other project" }] }} create />, "/goals/new?context=context-1");
    expect(screen.getByRole("link", { name: "Project One" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Other project" })).toBeNull();
    expect(screen.getByRole("link", { name: "Cancel" }).getAttribute("href")).toBe("/goals?context=context-1");
  });

  it("explains how to unblock creation with no available project", () => {
    inRouter(<GoalsView data={{ ...data, projects: [] }} create />, "/goals/new");
    expect(screen.getByText("Register a project with Senderos before creating a goal.")).toBeTruthy();
  });

  it("preserves the scoped create form fields and avoids duplicate New goal actions", () => {
    inRouter(<GoalsView data={data} projectId="project-1" create />, "/projects/project-1/goals/new");
    for (const label of ["Title", "Category", "Sendero", "Specification"]) expect(screen.getByLabelText(label)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Create goal" }).className).toBe("button button-primary");
    expect(screen.queryByRole("link", { name: "New goal" })).toBeNull();
    expect(screen.getByRole("link", { name: "Cancel" }).getAttribute("href")).toBe("/projects/project-1/goals?project=project-1");
  });

  it("shows only unselected scope metadata and keeps complete goal titles and deep links", () => {
    const title = "A complete outcome title that stays available even when the viewport becomes narrow";
    const scoped = { ...data, goals: [{ ...data.goals[0]!, title }] };
    inRouter(<GoalsView data={scoped} projectId="project-1" create={false} />);
    expect(screen.getByText(title)).toBeTruthy();
    expect(screen.getByText("feature")).toBeTruthy();
    expect(screen.queryByText(/Context One|Project One/)).toBeNull();
    expect(screen.getByRole("link", { name: new RegExp(title) }).getAttribute("href")).toBe("/projects/project-1/canvas/goals/goal-1");
    cleanup();
    inRouter(<GoalsView data={scoped} create={false} />, "/goals?context=context-1");
    expect(screen.getByText("Project One · feature")).toBeTruthy();
    expect(screen.queryByText(/Context One/)).toBeNull();
    cleanup();
    inRouter(<GoalsView data={scoped} create={false} />);
    expect(screen.getByText("Context One · Project One · feature")).toBeTruthy();
  });

  it("provides useful empty states for reviews, events, and agents", () => {
    const empty = { ...data, agents: [], attempts: [], events: [] };
    inRouter(<><ReviewsView data={empty} /><EventsView data={empty} /><AgentsView data={empty} /></>);
    expect(screen.getByRole("heading", { name: "No evidence to review" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "View runs" }).getAttribute("href")).toBe("/runs");
    expect(screen.getByRole("heading", { name: "No events in this scope" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "No agents yet" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "New agent" }).getAttribute("href")).toBe("/agents/new");
  });
});
