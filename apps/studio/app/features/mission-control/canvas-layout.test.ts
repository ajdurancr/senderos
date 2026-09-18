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
    const positions = automaticCanvasLayout(["start", "agent-1", "agent-2", "end"]);
    const distinctPositions = new Set(
      Object.values(positions).map(({ x, y }) => `${x}:${y}`),
    );
    expect(distinctPositions.size).toBe(4);
    expect(positions["agent-2"]?.y).toBe(80);
    expect(canvasBounds(positions)).toEqual({ width: 1084, height: 510 });
    expect(canvasBounds({ distant: { x: 1_000, y: 700 } })).toEqual({ width: 1224, height: 856 });
  });
});
