import { expect, test } from "bun:test";

import { activateGoal, createGoal } from "../goals";
import { updateRunAttempt } from "../attempts";
import { plan } from "../planning";
import { dispatchRun, getRun } from "../runs";
import { createProjectFixture, initHome } from "../../test-support/runtime";
import {
  getSenderoGraph,
  listSenderoGraphs,
  listSenderoVersions,
  updateSenderoEdge,
  updateSenderoNode,
  updateSenderoNodePosition,
} from ".";

test("built-in Sendero is a connected, versioned, reusable trail", async () => {
  const home = await initHome();
  const graph = (await listSenderoGraphs(home)).find(
    (item) => item.sendero.slug === "software-delivery",
  );
  expect(graph?.sendero.slug).toBe("software-delivery");
  expect(graph?.version.status).toBe("published");
  expect(await listSenderoVersions(home)).toHaveLength(4);
  expect(graph?.nodes).toHaveLength(7);
  expect(graph?.edges).toHaveLength(6);
  expect(graph?.nodes.filter((node) => node.kind === "agent")).toHaveLength(5);
  expect(
    graph?.edges.every(
      (edge) =>
        graph.nodes.some((node) => node.id === edge.sourceNodeId) &&
        graph.nodes.some((node) => node.id === edge.targetNodeId),
    ),
  ).toBe(true);
  await updateSenderoNode({
    home,
    id: graph!.nodes[1]!.id,
    label: "Refine intent",
  });
  await updateSenderoEdge({
    home,
    id: graph!.edges[1]!.id,
    name: "ready for framing",
    transitionObjective: "Frame the refined intent.",
  });
  const updated = await getSenderoGraph(graph!.sendero.id, 1, home);
  expect(updated?.nodes[1]?.label).toBe("Refine intent");
  expect(updated?.edges[1]).toMatchObject({
    name: "ready for framing",
    transitionObjective: "Frame the refined intent.",
  });
});

test("Sendero layout is durable and runs reference the assigned version", async () => {
  const home = await initHome();
  const project = await createProjectFixture(home);
  const graph = (await listSenderoGraphs(home)).find(
    (item) => item.sendero.slug === "software-delivery",
  )!;
  const node = graph.nodes[1]!;
  await updateSenderoNodePosition({
    home,
    id: node.id,
    positionX: 444,
    positionY: 222,
  });
  expect(
    (await getSenderoGraph(graph.sendero.id, 1, home))?.nodes.find(
      (item) => item.id === node.id,
    ),
  ).toMatchObject({ positionX: 444, positionY: 222 });

  const goal = (await activateGoal(
    (
      await createGoal({
        home,
        projectId: project.id,
        title: "Follow the trail",
      })
    ).id,
    home,
  ))!;
  expect(goal.senderoVersionId).toBe(graph.version.id);
  const first = (await plan({ home }))[0]!;
  expect(first.agentId).toBe(
    graph.nodes.find((item) => item.label === "Clarify")!.agentId!,
  );
  const dispatched = await dispatchRun(
    { ...first, previousRunId: first.previousRunId ?? undefined },
    home,
  );
  const run = await getRun(dispatched.runId, home);
  expect(run?.senderoVersionId).toBe(graph.version.id);
  await updateRunAttempt(dispatched.attemptId, { status: "succeeded" }, home);
  const second = (await plan({ home }))[0]!;
  expect(second.agentId).toBe(
    graph.nodes.find((item) => item.label === "Frame handoff")!.agentId!,
  );
  const secondRun = await dispatchRun(
    { ...second, previousRunId: second.previousRunId ?? undefined },
    home,
  );
  await updateRunAttempt(secondRun.attemptId, { status: "failed" }, home);
  expect((await plan({ home }))[0]?.transitionId).toBe(second.transitionId);
});
