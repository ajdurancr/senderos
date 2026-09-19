import { expect, test } from "bun:test";

import { getSenderoGraph } from "../../commands/senderos";
import { initHome } from "../../test-support/runtime";
import { assertConnectedSendero } from "./graph-invariants";

test("validates Sendero boundaries and reachability in both directions", async () => {
  const graph = (await getSenderoGraph(
    "software-delivery",
    undefined,
    await initHome(),
  ))!;
  expect(() => assertConnectedSendero(graph, graph.edges)).not.toThrow();
  expect(() =>
    assertConnectedSendero(
      { ...graph, nodes: graph.nodes.filter((node) => node.kind === "agent") },
      graph.edges,
    ),
  ).toThrow("start and end boundaries");

  const start = graph.nodes.find((node) => node.kind === "start")!;
  expect(() =>
    assertConnectedSendero(
      graph,
      graph.edges.filter((edge) => edge.sourceNodeId !== start.id),
    ),
  ).toThrow("agents unreachable");

  const end = graph.nodes.find((node) => node.kind === "end")!;
  expect(() =>
    assertConnectedSendero(
      graph,
      graph.edges.filter((edge) => edge.targetNodeId !== end.id),
    ),
  ).toThrow("without a path to completion");
});
