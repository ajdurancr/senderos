import { expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getAgentBySlug } from "./get-by-slug";
import { listAgents } from "./list";
import { seedBuiltInAgents } from "../../bootstrap/seed-agents";
import { createAgentTransition, listAgentTransitions } from "../transitions";
import { initHome, tempHome } from "../../test-support/runtime";

test("agent service seeds executors and supports explicit transitions", async () => {
  const home = await initHome();
  const agent = (await getAgentBySlug("spec-partner", home))!;
  const transition = await createAgentTransition({
    home,
    sourceAgentId: agent.id,
    name: "Implementation handoff",
    transitionObjective: "Implement the approved goal.",
  });
  expect((await listAgents(home)).length).toBeGreaterThan(0);
  expect(
    (await listAgentTransitions(home)).some(
      (item) => item.id === transition.id,
    ),
  ).toBe(true);
  await seedBuiltInAgents(home);
  expect(await listAgents(home)).not.toHaveLength(0);
});

test("agent seeding supplies a default objective when a definition omits one", async () => {
  const home = await initHome();
  const definitionsDir = join(tempHome(), "agents");
  mkdirSync(definitionsDir);
  writeFileSync(
    join(definitionsDir, "focused.json"),
    JSON.stringify({
      id: "focused-agent",
      slug: "focused",
      name: "Focused agent",
    }),
  );

  await seedBuiltInAgents(home, { definitionsDir });
  expect((await getAgentBySlug("focused", home))?.defaultGoal).toContain(
    "Run focused",
  );
});
