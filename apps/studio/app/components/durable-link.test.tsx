import { expect, test } from "vitest";

import { DurableLink } from "./durable-link";

test("uses full document navigation for Studio destinations", () => {
  const link = DurableLink({ to: "/projects/demo/goals", children: "Goals" });
  expect(link.props).toMatchObject({
    to: "/projects/demo/goals",
    reloadDocument: true,
  });
});
