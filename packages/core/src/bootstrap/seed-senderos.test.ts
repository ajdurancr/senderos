import { expect, test } from "bun:test";

import { listSenderoGraphs } from "../mission-control/senderos";
import { initHome } from "../test-support/runtime";
import { seedBuiltInSenderos } from "./seed-senderos";

test("built-in Sendero seeding is idempotent", async () => {
  const home = await initHome();
  await expect(seedBuiltInSenderos(home)).resolves.toHaveLength(5);
  await expect(seedBuiltInSenderos(home)).resolves.toHaveLength(5);
  const graphs = await listSenderoGraphs(home);
  expect(graphs).toHaveLength(5);
  expect(graphs.every((graph) => graph.nodes.length === 7)).toBe(true);
  expect(graphs.every((graph) => graph.edges.length === 6)).toBe(true);
  const demo = graphs.find((graph) => graph.sendero.slug === "timed-wait-demo")!;
  expect(demo.nodes.filter((node) => node.kind === "agent").map((node) => node.label)).toEqual([
    "Wait 1 minute",
    "Wait 2 minutes",
    "Wait 3 minutes",
    "Wait 4 minutes",
    "Wait 5 minutes",
  ]);
});
