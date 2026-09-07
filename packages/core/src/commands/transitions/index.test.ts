import { expect, test } from "bun:test";
import { getAgentBySlug } from "../agents/get-by-slug";
import {
  createAgentTransition,
  getAgentTransition,
  listAgentTransitionsForAgent,
} from "./index";
import { initHome } from "../../test-support/runtime";

test("transition commands create, read, and filter agent handoffs", async () => {
  const home = await initHome();
  const agent = (await getAgentBySlug("spec-partner", home))!;
  const transition = await createAgentTransition({
    home,
    sourceAgentId: agent.id,
    name: "Implement handoff",
    transitionObjective: "Implement the approved work.",
  });

  expect((await getAgentTransition(transition.id, home))?.id).toBe(
    transition.id,
  );
  expect(await listAgentTransitionsForAgent(agent.id, home)).toContainEqual(
    transition,
  );
});
