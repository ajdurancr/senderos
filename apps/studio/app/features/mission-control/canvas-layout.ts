export type CanvasPoint = { x: number; y: number };
export type CanvasPositions = Record<string, CanvasPoint>;

export const canvasNodeSize = { width: 164, height: 96 } as const;

export function automaticCanvasLayout(nodeIds: string[]): CanvasPositions {
  return Object.fromEntries(
    nodeIds.map((id, index) => [
      id,
      {
        x: 50 + index * 270,
        y:
          index > 0 && index < nodeIds.length - 1 && index % 2 === 0 ? 80 : 220,
      },
    ]),
  );
}

export function canvasNodeStyle(point: CanvasPoint) {
  return { left: point.x, top: point.y };
}

export function canvasBounds(positions: CanvasPositions) {
  return {
    width: Math.max(
      960,
      ...Object.values(positions).map(
        (point) => point.x + canvasNodeSize.width + 60,
      ),
    ),
    height: Math.max(
      510,
      ...Object.values(positions).map(
        (point) => point.y + canvasNodeSize.height + 60,
      ),
    ),
  };
}
