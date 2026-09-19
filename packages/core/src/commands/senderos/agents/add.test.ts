import { expect, test } from "bun:test";
import { initHome } from "../../../test-support/runtime";
import { addAgentToSendero } from "./add";

test("requires a connection point when adding to a populated Sendero", async () => {
  await expect(
    addAgentToSendero({
      home: await initHome(),
      senderoId: "software-delivery",
      agentId: "incident-responder",
    }),
  ).rejects.toThrow("requires --from, --to, or both");
});
