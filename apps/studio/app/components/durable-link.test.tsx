import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, type LinkProps } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DurableLink } from "./durable-link";

const renderedLinks = vi.hoisted(() => ({ props: [] as Array<{ reloadDocument?: boolean }> }));
vi.mock("react-router", async importOriginal => {
  const original = await importOriginal<typeof import("react-router")>();
  return { ...original, Link: (props: LinkProps) => { renderedLinks.props.push(props); return <original.Link {...props} />; } };
});
afterEach(() => { cleanup(); renderedLinks.props = []; });

function href(to: LinkProps["to"], from = "/now") {
  render(<MemoryRouter initialEntries={[from]}><DurableLink to={to}>Destination</DurableLink></MemoryRouter>);
  return screen.getByRole("link", { name: "Destination" }).getAttribute("href");
}

describe("DurableLink", () => {
  it("preserves full-document navigation even when callers request client navigation", () => {
    render(<MemoryRouter><DurableLink to="/projects/demo/goals" reloadDocument={false}>Goals</DurableLink></MemoryRouter>);
    expect(renderedLinks.props.at(-1)?.reloadDocument).toBe(true);
    expect(screen.getByRole("link", { name: "Goals" }).getAttribute("href")).toBe("/projects/demo/goals");
  });
  it("carries only context and project, retaining destination plan and hash", () => {
    expect(href("/canvas?plan=true#activation", "/now?context=context-1&project=project-1&filter=failed&stale=true")).toBe("/canvas?plan=true&context=context-1&project=project-1#activation");
  });
  it("derives owning project scope from a project deep link", () => {
    expect(href("/settings", "/projects/project-1/canvas/goals/goal-1?context=context-1")).toBe("/settings?context=context-1&project=project-1");
  });
  it("uses a destination entity's owning project instead of the previous scope", () => {
    expect(href("/projects/project-2/canvas/goals/goal-2", "/now?context=context-1&project=project-1")).toBe("/projects/project-2/canvas/goals/goal-2?context=context-1&project=project-2");
  });
  it("honors explicitly selected destination scope including empty selections", () => {
    expect(href("/goals?context=context-2&project=", "/now?context=context-1&project=project-1")).toBe("/goals?context=context-2&project=");
  });
  it("roundtrips encoded project IDs without encoding the query twice", () => {
    expect(href("/reviews", "/projects/a%20b/canvas?context=research%20team")).toBe("/reviews?context=research+team&project=a+b");
  });
  it.each(["https://example.com/report", "//example.com/report"])("does not append private scope to external destination %s", destination => {
    expect(href(destination, "/now?context=private&project=secret")).toBe(destination);
  });
  it("preserves object-form destinations and local fragments", () => {
    expect(href({ pathname: "/goals", search: "?project=explicit", hash: "#goal" }, "/now?context=private")).toBe("/goals?project=explicit#goal");
  });
});
