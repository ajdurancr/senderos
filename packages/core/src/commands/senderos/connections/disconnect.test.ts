import { expect, test } from "bun:test";
import { initHome } from "../../../test-support/runtime";
import { disconnectSenderoAgents } from "./disconnect";

test("refuses to disconnect the only path through a Sendero", async () => {
  await expect(
    disconnectSenderoAgents({
      home: await initHome(),
      senderoId: "software-delivery",
      from: "tdd-craftsman",
      to: "mutation-tester",
    }),
  ).rejects.toThrow(/unreachable|without a path to completion/);
});
