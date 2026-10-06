import { draftSendero } from "../../lifecycle/versions";
import { expect, test } from "bun:test";
import { getSenderoGraph } from "../../commands/senderos";
import { initHome } from "../../test-support/runtime";
import { updateSenderoEdge } from "./update-edge";

test("updates Sendero arc configuration", async () => {
  const home = await initHome();
  await draftSendero("software-delivery", home);
  const edge = (await getSenderoGraph("software-delivery", 2, home))!.edges[1]!;
  await expect(
    updateSenderoEdge({ home, id: edge.id, name: "ready" }),
  ).resolves.toMatchObject({ name: "ready" });
});
