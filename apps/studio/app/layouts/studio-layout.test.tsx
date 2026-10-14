import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { createMemoryRouter, MemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StudioLayout } from "./studio-layout";
import { parseStudioPath } from "../features/mission-control/navigation";
import { missionControlFixture as data } from "../test-support/mission-control-fixture";
import type { MissionControlData } from "../features/mission-control/server";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function shell(path = "/now", fixture: MissionControlData = data, pending = false) {
  const url = new URL(path, "https://studio.test");
  const router = createMemoryRouter([{ path: "*", element: <StudioLayout data={fixture} pending={pending} route={parseStudioPath(url.pathname)} search={url.searchParams}><p>Workspace content</p></StudioLayout> }], { initialEntries: [path] });
  return { router, ...render(<RouterProvider router={router} />) };
}
const dailyLabels = ["Now", "Workflow progress", "Goals", "Runs", "Reviews", "Settings"];

function scopedHref(link: HTMLElement) { return new URL(link.getAttribute("href")!, "https://studio.test"); }

describe("StudioLayout", () => {
  it("renders exactly the daily workspaces plus Settings, with labelled active and pending states", () => {
    shell("/goals", data, true);
    const nav = within(screen.getByRole("navigation", { name: "Studio navigation" }));
    expect(nav.getAllByRole("link").map(link => link.getAttribute("aria-label"))).toEqual(dailyLabels);
    for (const label of dailyLabels) {
      const link = nav.getByRole("link", { name: label });
      expect(link.getAttribute("title")).toBe(label);
      expect(link.querySelector("span")?.textContent).toBe(label);
    }
    expect(nav.getByRole("link", { name: "Goals" }).getAttribute("aria-current")).toBe("page");
    expect(nav.queryByRole("link", { name: "Events" })).toBeNull();
    expect(screen.getByRole("status").textContent).toBe("Applying change…");
    expect(screen.getByRole("progressbar", { name: "Applying change" })).toBeTruthy();
    expect(screen.getByRole("main").textContent).toContain("Workspace content");
    expect(screen.getByRole("link", { name: "Skip to content" }).getAttribute("href")).toBe("#studio-content");
  });

  it.each(["/settings", "/projects/project-1/settings", "/agents/agent-1", "/agents/new", "/senderos/sendero-1/nodes/node-agent", "/senderos/new", "/events"])("keeps the shared Settings hierarchy active at %s", path => {
    shell(`${path}?context=context-1&project=project-1`);
    expect(within(screen.getByRole("navigation", { name: "Studio navigation" })).getByRole("link", { name: "Settings" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("heading", { name: "Settings", level: 1 })).toBeTruthy();
    const tabs = within(screen.getByRole("navigation", { name: "Settings navigation" }));
    expect(tabs.getAllByRole("link").map(link => link.textContent)).toEqual(["Project & database", "Agents", "Senderos", "Diagnostics"]);
    const active = path.includes("agents") ? "Agents" : path.includes("senderos") ? "Senderos" : path === "/events" ? "Diagnostics" : "Project & database";
    expect(tabs.getByRole("link", { name: active }).getAttribute("aria-current")).toBe("page");
    for (const link of tabs.getAllByRole("link")) expect([...scopedHref(link).searchParams]).toEqual([["context", "context-1"], ["project", "project-1"]]);
    expect(scopedHref(tabs.getByRole("link", { name: "Diagnostics" })).pathname).toBe("/events");
  });

  it("retains context/project across navigation without leaking dispatch or attention filters", () => {
    shell("/projects/project-1/canvas/goals/goal-1?context=context-1&plan=true&filter=failed");
    for (const link of within(screen.getByRole("navigation", { name: "Studio navigation" })).getAllByRole("link")) {
      expect([...scopedHref(link).searchParams]).toEqual([["context", "context-1"], ["project", "project-1"]]);
    }
    expect(screen.queryByRole("navigation", { name: "Settings navigation" })).toBeNull();
    expect(scopedHref(screen.getByRole("link", { name: "New goal" })).pathname).toBe("/projects/project-1/goals/new");
  });

  it("uses project choice when creating a goal without an owning project", () => {
    shell("/now?context=context-1");
    expect(screen.getByRole("link", { name: "New goal" }).getAttribute("href")).toBe("/goals/new?context=context-1");
  });

  it("resets the project and deep entity selection when execution context changes", () => {
    const { router } = shell("/projects/project-1/canvas/goals/goal-1?context=context-1&plan=true");
    fireEvent.change(screen.getByRole("combobox", { name: "Execution context" }), { target: { value: "" } });
    expect(router.state.location.pathname).toBe("/canvas");
    expect(router.state.location.search).toBe("");
  });

  it("changes project while retaining context and clearing unrelated state", () => {
    const fixture = { ...data, projects: [...data.projects, { ...data.projects[0]!, id: "project-2", name: "Project Two" }] };
    const { router } = shell("/projects/project-1/runs/attempts/attempt-1?context=context-1&filter=failed", fixture);
    fireEvent.change(screen.getByRole("combobox", { name: "Project" }), { target: { value: "project-2" } });
    expect(router.state.location.pathname).toBe("/runs");
    expect(router.state.location.search).toBe("?context=context-1&project=project-2");
  });

  it("scopes review counts, dispatch counts, and palette entities while retaining full context choices", () => {
    const otherAttempt = { ...data.attempts[0]!, id: "attempt-2", runId: "run-2" };
    const fixture = { ...data,
      executionContexts: [...data.executionContexts, { ...data.executionContexts[0]!, id: "context-2", name: "Context Two" }],
      projects: [...data.projects, { ...data.projects[0]!, id: "project-2", executionContextId: "context-2", name: "Project Two" }],
      goals: [...data.goals, { ...data.goals[0]!, id: "goal-2", projectId: "project-2", title: "Unrelated launch" }],
      runs: [...data.runs, { ...data.runs[0]!, id: "run-2", goalId: "goal-2" }], attempts: [...data.attempts, otherAttempt],
      queue: { ...data.queue, reviews: [...data.queue.reviews, { attempt: otherAttempt, review: { status: "pending" as const } }], dispatchable: [...data.queue.dispatchable, { ...data.queue.dispatchable[0]!, activationId: "activation-2", goalId: "goal-2" }] },
    };
    shell("/now?context=context-1&project=project-1", fixture);
    const nav = within(screen.getByRole("navigation", { name: "Studio navigation" }));
    expect(nav.getByRole("link", { name: "Reviews" }).querySelector("em")?.textContent).toBe("1");
    expect(within(screen.getByRole("combobox", { name: "Execution context" })).getByRole("option", { name: "Context Two" })).toBeTruthy();
    expect(within(screen.getByRole("combobox", { name: "Project" })).queryByRole("option", { name: "Project Two" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Search or run a command" }));
    const dialog = within(screen.getByRole("dialog", { name: "Command palette" }));
    const input = dialog.getByRole("textbox", { name: "Search commands" });
    fireEvent.change(input, { target: { value: "dispatch" } });
    expect(dialog.getByRole("link", { name: /^Review dispatch plan/ }).getAttribute("href")).toBe("/projects/project-1/canvas?plan=true&context=context-1&project=project-1");
    expect(within(dialog.getByRole("link", { name: /^Review dispatch plan/ })).getByText("1 ready")).toBeTruthy();
    fireEvent.change(input, { target: { value: "Unrelated launch" } });
    expect(dialog.queryByRole("link")).toBeNull();
    expect(dialog.getByText("Nothing matches that query.")).toBeTruthy();
    fireEvent.change(input, { target: { value: "Ship feature" } });
    expect(dialog.getByRole("link", { name: /Ship feature/ }).getAttribute("href")).toBe("/projects/project-1/canvas/goals/goal-1?context=context-1&project=project-1");
  });

  it("hides the review badge for an empty selected scope", () => {
    shell("/now?project=missing");
    expect(within(screen.getByRole("navigation", { name: "Studio navigation" })).getByRole("link", { name: "Reviews" }).querySelector("em")).toBeNull();
  });

  it("traps drawer focus, makes background inert, isolates shortcuts, and restores focus on Escape", () => {
    const { container } = shell();
    const trigger = screen.getByRole("button", { name: "Open navigation" });
    const previousOverflow = document.body.style.overflow;
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Studio menu" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(container.querySelector(".studio-workspace")?.hasAttribute("inert")).toBe(true);
    expect(document.body.style.overflow).toBe("hidden");
    expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "Close navigation" }));
    const first = within(dialog).getByRole("link", { name: "Senderos Studio" });
    const last = within(dialog).getByRole("link", { name: "Settings" });
    last.focus(); fireEvent.keyDown(last, { key: "Tab" }); expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first, { key: "Tab", shiftKey: true }); expect(document.activeElement).toBe(last);
    fireEvent.keyDown(last, { key: "k", ctrlKey: true });
    expect(screen.queryByRole("dialog", { name: "Command palette" })).toBeNull();
    fireEvent.keyDown(last, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Studio menu" })).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(container.querySelector(".studio-workspace")?.hasAttribute("inert")).toBe(false);
    expect(document.body.style.overflow).toBe(previousOverflow);
  });

  it("dismisses the drawer through close button, backdrop, and desktop breakpoint without leaving a scroll lock", () => {
    let resize: (() => void) | undefined;
    const media = { matches: false, addEventListener: vi.fn((_event: string, fn: () => void) => { resize = fn; }), removeEventListener: vi.fn() };
    vi.stubGlobal("matchMedia", () => media);
    const { container, unmount } = shell();
    const trigger = screen.getByRole("button", { name: "Open navigation" });
    fireEvent.click(trigger); fireEvent.click(screen.getByRole("button", { name: "Close navigation" }));
    expect(document.activeElement).toBe(trigger);
    fireEvent.click(trigger); fireEvent.click(container.querySelector(".navigation-backdrop")!);
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(trigger); act(() => { media.matches = true; resize?.(); });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.body.style.overflow).not.toBe("hidden");
    unmount(); expect(media.removeEventListener).toHaveBeenCalledWith("change", resize);
  });

  it("disables JS-only scope, search, and menu controls in server markup until client handlers are ready", () => {
    const html = renderToString(<MemoryRouter><StudioLayout data={data} pending={false} route={parseStudioPath("/now")} search={new URLSearchParams()}><p>Content</p></StudioLayout></MemoryRouter>);
    const server = document.createElement("div"); server.innerHTML = html;
    expect([...server.querySelectorAll("select")]).toHaveLength(2);
    expect([...server.querySelectorAll("select")].every(select => select.disabled)).toBe(true);
    expect(server.querySelector<HTMLButtonElement>('[aria-label="Search or run a command"]')?.disabled).toBe(true);
    expect(server.querySelector<HTMLButtonElement>('[aria-label="Open navigation"]')?.disabled).toBe(true);
    shell();
    expect(screen.getByRole("combobox", { name: "Project" })).toHaveProperty("disabled", false);
    expect(screen.getByRole("button", { name: "Open navigation" })).toHaveProperty("disabled", false);
    expect(screen.getByRole("button", { name: "Search or run a command" })).toHaveProperty("disabled", false);
  });
});
