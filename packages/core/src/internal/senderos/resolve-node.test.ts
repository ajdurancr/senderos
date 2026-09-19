import { expect, test } from "bun:test";
import { getSenderoGraph } from "../../commands/senderos";
import { initHome } from "../../test-support/runtime";
import { resolveSenderoAgentNode, resolveSenderoNode } from "./resolve-node";

test("resolves agent and boundary references while keeping them distinct", async () => {
  const home = await initHome();
  const graph = (await getSenderoGraph("software-delivery", undefined, home))!;
  await expect(resolveSenderoAgentNode(graph, "judge", home)).resolves.toMatchObject({ kind: "agent" });
  await expect(resolveSenderoNode(graph, "start", home)).resolves.toMatchObject({ kind: "start" });
  await expect(resolveSenderoAgentNode(graph, "start", home)).rejects.toThrow("Sendero agent not found");
});
