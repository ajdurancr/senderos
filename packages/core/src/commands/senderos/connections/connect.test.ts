import { draftSendero } from "../../../lifecycle/versions";
import { expect, test } from "bun:test";
import { initHome } from "../../../test-support/runtime";
import { connectSenderoAgents } from "./connect";

test("rejects self-connections between Sendero agents", async () => {
  const home = await initHome();
  await draftSendero("software-delivery", home);
  await expect(
    connectSenderoAgents({
      home,
      senderoId: "software-delivery",
      from: "judge",
      to: "judge",
    }),
  ).rejects.toThrow("cannot connect to itself");
});
