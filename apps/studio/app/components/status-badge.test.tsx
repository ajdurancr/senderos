import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";

import { StatusBadge } from "./status-badge";

afterEach(cleanup);

test.each([
  ["succeeded", "bg-emerald-400/10"],
  ["failed", "bg-rose-400/10"],
  ["running", "bg-cyan-400/10"],
  ["changes_requested", "bg-slate-700/50"],
])("renders %s with its readable label and tone", (value, tone) => {
  render(<StatusBadge value={value} />);

  const badge = screen.getByText(value.replaceAll("_", " "));
  expect(badge.className).toContain(tone);
});
