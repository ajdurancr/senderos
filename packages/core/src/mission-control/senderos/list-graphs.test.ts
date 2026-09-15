import { expect, test } from "bun:test";
import { initHome } from "../../test-support/runtime";
import { listSenderoGraphs } from "./list-graphs";

test("lists one current graph for every Sendero", async () => {
  const graphs = await listSenderoGraphs(await initHome());
  expect(graphs.map((graph) => graph.sendero.slug)).toEqual([
    "software-delivery",
    "dependency-upgrade",
    "production-hotfix",
    "security-hardening",
  ]);
});
