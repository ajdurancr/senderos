import { draftSendero } from "../../../lifecycle/versions";
import { expect, test } from "bun:test";
import { initHome } from "../../../test-support/runtime";
import { addAgentToSendero } from "./add";

test("requires a connection point when adding to a populated Sendero", async () => {
  const home = await initHome();
  await draftSendero("software-delivery", home);
  await expect(
    addAgentToSendero({
      home,
      senderoId: "software-delivery",
      agentId: "incident-responder",
    }),
  ).rejects.toThrow("requires --from, --to, or both");
});
