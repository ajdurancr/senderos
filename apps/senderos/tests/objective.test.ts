import { describe, expect, test } from "bun:test";

import { createObjective, summarizeValidation } from "../src/index";

describe("createObjective", () => {
  test("creates a draft objective with timestamps", () => {
    const objective = createObjective({
      id: "obj_1",
      title: "Define the first objective",
      summary: "Capture orchestration intent.",
    });

    expect(objective.status).toBe("draft");
    expect(objective.createdAt).toBeString();
    expect(objective.updatedAt).toBeString();
  });
});

describe("summarizeValidation", () => {
  test("returns high confidence for strong pass ratios", () => {
    expect(summarizeValidation(9, 10).confidence).toBe("high");
  });

  test("returns low confidence when there are no checks", () => {
    expect(summarizeValidation(0, 0).confidence).toBe("low");
  });
});
