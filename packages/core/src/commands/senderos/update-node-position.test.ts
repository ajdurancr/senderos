import { expect, test } from "bun:test";
import { initHome } from "../../test-support/runtime";
import { getSenderoGraph } from "./get-graph";
import { updateSenderoNodePosition } from "./update-node-position";

test("persists rounded canvas coordinates", async () => {
  const home = await initHome();
  const node = (await getSenderoGraph("software-delivery", 1, home))!.nodes[0]!;
  await expect(
    updateSenderoNodePosition({
      home,
      id: node.id,
      positionX: 90.4,
      positionY: 70.8,
    }),
  ).resolves.toMatchObject({ positionX: 90, positionY: 71 });
});
