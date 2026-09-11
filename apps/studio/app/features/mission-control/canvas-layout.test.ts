import { describe, expect, it } from "vitest";

import {
  automaticCanvasLayout,
  canvasBounds,
  canvasNodeStyle,
} from "./canvas-layout";

describe("Sendero canvas layout", () => {
  it("converts graph coordinates into positioned CSS", () => {
    expect(canvasNodeStyle({ x: 330, y: 220 })).toEqual({
      left: 330,
      top: 220,
    });
  });

  it("places nodes separately and calculates a scrollable stage", () => {
    const positions = automaticCanvasLayout(["start", "agent", "end"]);
    const distinctPositions = new Set(
      Object.values(positions).map(({ x, y }) => `${x}:${y}`),
    );
    expect(distinctPositions.size).toBe(3);
    expect(canvasBounds(positions)).toEqual({ width: 960, height: 510 });
  });
});
