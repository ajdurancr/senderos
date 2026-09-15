import { expect, test } from "bun:test";

import { initHome } from "../../test-support/runtime";
import {
  addAgentToSendero,
  connectSenderoNodes,
  disconnectSenderoNodes,
  getSenderoGraph,
  removeAgentFromSendero,
} from ".";

test("manages agents and connections through Sendero business actions", async () => {
  const home = await initHome();
  const node = await addAgentToSendero({
    home,
    senderoId: "software-delivery",
    agentId: "incident-responder",
  });
  expect(node.kind).toBe("agent");

  const edge = await connectSenderoNodes({
    home,
    senderoId: "software-delivery",
    from: "mutation-tester",
    to: "incident-responder",
    name: "escalate",
    objective: "Respond to the discovered issue.",
  });
  expect(edge.targetNodeId).toBe(node.id);
  await expect(
    connectSenderoNodes({
      home,
      senderoId: "software-delivery",
      from: "mutation-tester",
      to: "incident-responder",
      name: "duplicate",
      objective: "Duplicate connection.",
    }),
  ).rejects.toThrow("already exists");

  await disconnectSenderoNodes({
    home,
    senderoId: "software-delivery",
    from: "mutation-tester",
    to: "incident-responder",
  });
  await expect(
    disconnectSenderoNodes({
      home,
      senderoId: "software-delivery",
      from: "mutation-tester",
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
      (item) => item.id === node.id,
    ),
  ).toBe(false);
});
