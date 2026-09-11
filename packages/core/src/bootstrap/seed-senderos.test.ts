import { expect, test } from "bun:test";

import { listSenderoGraphs } from "../commands/senderos";
import { initHome } from "../test-support/runtime";
import { seedBuiltInSenderos } from "./seed-senderos";

test("built-in Sendero seeding is idempotent", async () => {
  const home = await initHome();
  await expect(seedBuiltInSenderos(home)).resolves.toHaveLength(4);
  await expect(seedBuiltInSenderos(home)).resolves.toHaveLength(4);
  const graphs = await listSenderoGraphs(home);
  expect(graphs).toHaveLength(4);
  expect(graphs.every((graph) => graph.nodes.length === 7)).toBe(true);
  expect(graphs.every((graph) => graph.edges.length === 6)).toBe(true);
});
