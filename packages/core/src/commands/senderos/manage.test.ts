import { expect, test } from "bun:test";

import { initHome } from "../../test-support/runtime";
import {
  addAgentToSendero,
  connectSenderoAgents,
  disconnectSenderoAgents,
  getSenderoGraph,
  removeAgentFromSendero,
} from ".";

test("manages agents and connections through Sendero business actions", async () => {
  const home = await initHome();
  const node = await addAgentToSendero({
    home,
    senderoId: "software-delivery",
    agentId: "incident-responder",
    from: "mutation-tester",
  });
  expect(node.agent.kind).toBe("agent");

  const edge = await connectSenderoAgents({
    home,
    senderoId: "software-delivery",
    from: "tdd-craftsman",
    to: "incident-responder",
  });
  expect(edge.targetNodeId).toBe(node.agent.id);
  await expect(
    connectSenderoAgents({
      home,
      senderoId: "software-delivery",
      from: "tdd-craftsman",
      to: "incident-responder",
    }),
  ).rejects.toThrow("already exists");

  await disconnectSenderoAgents({
    home,
    senderoId: "software-delivery",
    from: "tdd-craftsman",
    to: "incident-responder",
  });
  await expect(
    disconnectSenderoAgents({
      home,
      senderoId: "software-delivery",
      from: "tdd-craftsman",
      to: "incident-responder",
    }),
  ).rejects.toThrow("not found");

  await removeAgentFromSendero({
    home,
    senderoId: "software-delivery",
    agentId: "incident-responder",
  });
  expect(
    (await getSenderoGraph("software-delivery", undefined, home))?.nodes.some(
      (item) => item.id === node.agent.id,
    ),
  ).toBe(false);
});

test("adding the first agent creates a complete one-agent Sendero", async () => {
  const home = await initHome();
  for (const agent of [
    "spec-partner",
    "craftsman-lead",
    "tdd-craftsman",
    "mutation-tester",
    "judge",
  ])
    await removeAgentFromSendero({
      home,
      senderoId: "software-delivery",
      agentId: agent,
    });

  const added = await addAgentToSendero({
    home,
    senderoId: "software-delivery",
    agentId: "incident-responder",
  });
  expect(added.connections).toHaveLength(2);
  const graph = (await getSenderoGraph("software-delivery", undefined, home))!;
  expect(graph.nodes.filter((node) => node.kind === "agent")).toHaveLength(1);
  expect(graph.edges).toHaveLength(2);
});
