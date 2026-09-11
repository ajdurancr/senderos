import { expect, test } from "bun:test";
import { initHome } from "../../test-support/runtime";
import { listSenderoVersions } from "./list-versions";

test("lists published Sendero versions", async () => {
  const versions = await listSenderoVersions(await initHome());
  expect(versions).toHaveLength(4);
  expect(versions.every((version) => version.status === "published")).toBe(
    true,
  );
});
