import { eq } from "drizzle-orm";

import { atomic, openRuntimeDb } from "../../db/client";
import { senderoNodes, senderoVersions } from "../../db/schema";
import { getSenderoGraph } from "../../commands/senderos/get-graph";
import { requireLifecycle } from "../../lifecycle/errors";
import { now } from "../../shared/ids";

export async function updateSenderoNodePosition(input: {
  id: string;
  positionX: number;
  positionY: number;
  expectedRevision?: string;
  home?: string;
}) {
  return atomic(input.home, async () => {
    const db = openRuntimeDb(input.home);
    const node = (await db.select().from(senderoNodes).where(eq(senderoNodes.id, input.id)))[0];
    requireLifecycle(node, "NOT_FOUND", `Sendero node not found: ${input.id}`);
    requireLifecycle(Number.isFinite(input.positionX) && Number.isFinite(input.positionY), "INVALID_INPUT", "Canvas coordinates must be finite numbers");
    if (input.expectedRevision !== undefined) {
      const version = (await db.select().from(senderoVersions).where(eq(senderoVersions.id, node.senderoVersionId)))[0]!;
      const graph = await getSenderoGraph(version.senderoId, version.version, input.home);
      requireLifecycle(graph?.revision === input.expectedRevision, "STALE_DRAFT", "The graph changed; reload it before saving its layout");
    }
    const positionX = Math.round(input.positionX), positionY = Math.round(input.positionY);
    await db.update(senderoNodes).set({ positionX, positionY, updatedAt: now() }).where(eq(senderoNodes.id, input.id));
    return (await db.select().from(senderoNodes).where(eq(senderoNodes.id, input.id)))[0];
  });
}

/** Presentation-only layout can change published versions; the whole save is atomic. */
export async function updateSenderoLayout(input: {
  senderoId: string;
  expectedVersionId: string;
  expectedRevision: string;
  positions: Record<string, { x: number; y: number }>;
  home?: string;
}) {
  return atomic(input.home, async () => {
    const version = (await openRuntimeDb(input.home).select().from(senderoVersions).where(eq(senderoVersions.id, input.expectedVersionId)))[0];
    requireLifecycle(version, "STALE_VERSION", "The Sendero version no longer exists");
    const graph = await getSenderoGraph(input.senderoId, version.version, input.home);
    requireLifecycle(graph?.version.id === input.expectedVersionId, "STALE_VERSION", "The layout belongs to another Sendero version");
    requireLifecycle(graph.revision === input.expectedRevision, "STALE_DRAFT", "The graph changed; reload it before saving its layout");
    requireLifecycle(input.positions && typeof input.positions === "object" && !Array.isArray(input.positions), "INVALID_INPUT", "Layout positions must be an object");
    const positions = Object.entries(input.positions);
    requireLifecycle(positions.length > 0 && positions.every(([id, point]) => graph.nodes.some(node => node.id === id) && point && Number.isFinite(point.x) && Number.isFinite(point.y)), "INVALID_INPUT", "Layout positions must reference this graph and contain finite coordinates");
    for (const [id, point] of positions) await updateSenderoNodePosition({ id, positionX: point.x, positionY: point.y, home: input.home });
    return getSenderoGraph(graph.sendero.id, graph.version.version, input.home);
  });
}
