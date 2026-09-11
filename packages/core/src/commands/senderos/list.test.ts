import { expect, test } from "bun:test";
import { initHome } from "../../test-support/runtime";
import { listSenderos } from "./list";

test("lists the built-in Senderos", async () => {
  expect(await listSenderos(await initHome())).toHaveLength(4);
});
