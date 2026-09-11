import { expect, test } from "bun:test";

import { listAgents, listSenderoGraphs } from "../commands";
import { tempHome } from "../test-support/runtime";
import { prepareSharedDatabase } from "./bootstrap";

test("prepareSharedDatabase migrates and seeds without a runtime config", async () => {
  const home = tempHome();
  process.env.SENDEROS_DATABASE_URL = `file:${home}/shared.db`;

  await expect(prepareSharedDatabase()).resolves.toBeUndefined();
  await expect(listAgents()).resolves.toHaveLength(9);
  await expect(listSenderoGraphs()).resolves.toHaveLength(4);
  await expect(prepareSharedDatabase()).resolves.toBeUndefined();
  await expect(listAgents()).resolves.toHaveLength(9);
  await expect(listSenderoGraphs()).resolves.toHaveLength(4);
});
