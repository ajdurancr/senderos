import { expect, test } from "bun:test";
import { initHome } from "../../../test-support/runtime";
import { connectSenderoAgents } from "./connect";

test("rejects self-connections between Sendero agents", async () => {
  await expect(
    connectSenderoAgents({
      home: await initHome(),
      senderoId: "software-delivery",
      from: "judge",
      to: "judge",
    }),
  ).rejects.toThrow("cannot connect to itself");
});
