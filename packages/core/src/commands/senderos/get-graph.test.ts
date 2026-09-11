import { expect, test } from "bun:test";
import { initHome } from "../../test-support/runtime";
import { getSenderoGraph } from "./get-graph";

test("gets the current graph by slug", async () => {
  const graph = await getSenderoGraph(
    "security-hardening",
    undefined,
    await initHome(),
  );
  expect(graph?.sendero.name).toBe("Security hardening");
  expect(graph?.nodes).toHaveLength(7);
});
