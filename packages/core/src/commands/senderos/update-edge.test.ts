import { expect, test } from "bun:test";
import { initHome } from "../../test-support/runtime";
import { getSenderoGraph } from "./get-graph";
import { updateSenderoEdge } from "./update-edge";

test("updates Sendero arc configuration", async () => {
  const home = await initHome();
  const edge = (await getSenderoGraph("software-delivery", 1, home))!.edges[1]!;
  await expect(
    updateSenderoEdge({ home, id: edge.id, name: "ready" }),
  ).resolves.toMatchObject({ name: "ready" });
});
