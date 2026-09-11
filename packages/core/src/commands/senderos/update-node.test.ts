import { expect, test } from "bun:test";
import { initHome } from "../../test-support/runtime";
import { getSenderoGraph } from "./get-graph";
import { updateSenderoNode } from "./update-node";

test("updates Sendero node configuration", async () => {
  const home = await initHome();
  const node = (await getSenderoGraph("software-delivery", 1, home))!.nodes[0]!;
  await expect(
    updateSenderoNode({ home, id: node.id, label: "Start here" }),
  ).resolves.toMatchObject({ label: "Start here" });
});
