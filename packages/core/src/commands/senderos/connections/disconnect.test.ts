import { draftSendero } from "../../../lifecycle/versions";
import { expect, test } from "bun:test";
import { initHome } from "../../../test-support/runtime";
import { disconnectSenderoAgents } from "./disconnect";

test("refuses to disconnect the only path through a Sendero", async () => {
  const home = await initHome();
  await draftSendero("software-delivery", home);
  await expect(
    disconnectSenderoAgents({
      home,
      senderoId: "software-delivery",
      from: "tdd-craftsman",
      to: "mutation-tester",
    }),
  ).rejects.toThrow(/unreachable|without a path to completion/);
});
