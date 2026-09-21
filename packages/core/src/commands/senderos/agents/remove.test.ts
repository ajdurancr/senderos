import { expect, test } from "bun:test";
import { initHome } from "../../../test-support/runtime";
import { addAgentToSendero } from "./add";
import { removeAgentFromSendero } from "./remove";

test("removes an agent and reconnects the surrounding Sendero", async () => {
  const home = await initHome();
  await addAgentToSendero({
    home,
    senderoId: "software-delivery",
    agentId: "incident-responder",
    from: "mutation-tester",
    to: "judge",
  });
  await expect(
    removeAgentFromSendero({
      home,
      senderoId: "software-delivery",
      agentId: "incident-responder",
    }),
  ).resolves.toMatchObject({
    removedConnections: 2,
    connections: [{ sourceNodeId: expect.stringMatching(/^sendero-/), targetNodeId: expect.stringMatching(/^sendero-/) }],
  });
});
