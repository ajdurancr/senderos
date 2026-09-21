import type { SenderoEdgeRecord, SenderoGraph } from "../../shared/types";

export function assertConnectedSendero(
  graph: SenderoGraph,
  edges: Pick<SenderoEdgeRecord, "sourceNodeId" | "targetNodeId">[],
) {
  const start = graph.nodes.find((node) => node.kind === "start");
  const end = graph.nodes.find((node) => node.kind === "end");
  if (!start || !end) throw new Error("Sendero must have start and end boundaries");

  const reachable = new Set([start.id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const edge of edges) {
      if (reachable.has(edge.sourceNodeId) && !reachable.has(edge.targetNodeId)) {
        reachable.add(edge.targetNodeId);
        changed = true;
      }
    }
  }
  const unreachable = graph.nodes.filter(
    (node) => node.kind === "agent" && !reachable.has(node.id),
  );
  if (unreachable.length)
    throw new Error(`Connection would make agents unreachable: ${unreachable.map((node) => node.label).join(", ")}`);

  const reachesEnd = new Set([end.id]);
  changed = true;
  while (changed) {
    changed = false;
    for (const edge of edges) {
      if (reachesEnd.has(edge.targetNodeId) && !reachesEnd.has(edge.sourceNodeId)) {
        reachesEnd.add(edge.sourceNodeId);
        changed = true;
      }
    }
  }
  const deadEnds = graph.nodes.filter(
    (node) => node.kind === "agent" && !reachesEnd.has(node.id),
  );
  if (deadEnds.length)
    throw new Error(`Connection would leave agents without a path to completion: ${deadEnds.map((node) => node.label).join(", ")}`);
}
