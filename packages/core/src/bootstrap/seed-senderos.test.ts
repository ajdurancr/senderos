import { expect, test } from "bun:test";

import { listSenderoGraphs } from "../commands/senderos";
import { initHome } from "../test-support/runtime";
import { seedBuiltInSenderos } from "./seed-senderos";

test("built-in Sendero seeding is idempotent", async () => {
  const home = await initHome();
  await expect(seedBuiltInSenderos(home)).resolves.toBe("sendero-software-delivery");
  await expect(seedBuiltInSenderos(home)).resolves.toBe("sendero-software-delivery");
  const graphs = await listSenderoGraphs(home);
  expect(graphs).toHaveLength(1);
  expect(graphs[0]?.nodes).toHaveLength(7);
  expect(graphs[0]?.edges).toHaveLength(6);
});
