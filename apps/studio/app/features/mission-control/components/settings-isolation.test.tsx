import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SettingsView } from "./workspace-views";
import { missionControlFixture as base } from "../../../test-support/mission-control-fixture";

afterEach(cleanup);
const second = { ...base.projects[0]!, id: "project-2", name: "Next campaign", githubOwner: "", githubRepo: "", targetBranch: "", integrationMode: "none" as const };
const data = { ...base, projects: [...base.projects, second] };
function Harness() {
  const [projectId, setProjectId] = useState("project-1");
  return <><button onClick={() => setProjectId("project-1")}>Select launch</button><button onClick={() => setProjectId("project-2")}>Select campaign</button><SettingsView data={data} projectId={projectId} /></>;
}

describe("project settings isolation", () => {
  it("discards the previous project's uncontrolled edits on scope change and submits only the newly selected identity", async () => {
    const submissions: FormData[] = [];
    const action = vi.fn(async ({ request }: { request: Request }) => { submissions.push(await request.formData()); return { ok: true }; });
    render(<RouterProvider router={createMemoryRouter([{ path: "*", element: <Harness />, action }])} />);
    const firstName = screen.getByRole("textbox", { name: /^Name/ });
    fireEvent.change(firstName, { target: { value: "Unsaved launch title" } });
    fireEvent.change(screen.getByRole("textbox", { name: /^Target branch/ }), { target: { value: "unsaved-launch-branch" } });
    fireEvent.change(screen.getByRole("combobox", { name: /^Integration mode/ }), { target: { value: "local_merge" } });
    fireEvent.click(screen.getByRole("button", { name: "Select campaign" }));
    const secondName = screen.getByRole("textbox", { name: /^Name/ });
    expect(secondName).not.toBe(firstName);
    expect(secondName).toHaveProperty("value", "Next campaign");
    expect(screen.getByRole("textbox", { name: /^Target branch/ })).toHaveProperty("value", "");
    expect(screen.getByRole("combobox", { name: /^Integration mode/ })).toHaveProperty("value", "none");
    expect(action).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole("textbox", { name: /^Target branch/ }), { target: { value: "campaign-preview" } });
    fireEvent.change(screen.getByRole("combobox", { name: /^Integration mode/ }), { target: { value: "local_merge" } });
    fireEvent.click(screen.getByRole("button", { name: "Save project" }));
    await waitFor(() => expect(submissions).toHaveLength(1));
    expect(Object.fromEntries(submissions[0]!)).toEqual({ intent: "update-project", projectId: "project-2", name: "Next campaign", targetBranch: "campaign-preview", integrationMode: "local_merge" });
    await screen.findByRole("button", { name: "Save project" });
    fireEvent.click(screen.getByRole("button", { name: "Select launch" }));
    expect(screen.getByRole("textbox", { name: /^Name/ })).toHaveProperty("value", "Project One");
    expect(screen.getByRole("textbox", { name: /^Target branch/ })).toHaveProperty("value", "main");
    expect(screen.getByRole("combobox", { name: /^Integration mode/ })).toHaveProperty("value", "github_pr");
  });

  it("rejects an empty required name before submission and keeps runtime fields read-only", () => {
    const action = vi.fn(() => null);
    render(<RouterProvider router={createMemoryRouter([{ path: "*", element: <SettingsView data={data} projectId="project-1" />, action }])} />);
    const name = screen.getByRole("textbox", { name: /^Name/ }) as HTMLInputElement;
    fireEvent.change(name, { target: { value: "" } });
    expect(name.required).toBe(true);
    expect(name.checkValidity()).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Save project" }));
    expect(action).not.toHaveBeenCalled();
    for (const label of [/^Repository/, /^Endpoint/, /^Connection mode/, /^Database URL variable/, /^Auth token variable/]) {
      expect(screen.getByRole("textbox", { name: label })).toHaveProperty("disabled", true);
    }
  });

  it("retains database diagnostics with an honest empty project scope and no Save action", () => {
    render(<RouterProvider router={createMemoryRouter([{ path: "*", element: <SettingsView data={{ ...data, projects: [] }} projectId="missing" /> }])} />);
    expect(screen.getByRole("heading", { name: "No project in this scope" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Shared database" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Save project" })).toBeNull();
    expect(screen.getByRole("textbox", { name: /^Endpoint/ })).toHaveProperty("value", data.runtime.database.endpoint);
  });
});
