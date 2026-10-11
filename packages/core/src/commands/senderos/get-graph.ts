import { createHash } from "node:crypto";
import { asc, eq, inArray } from "drizzle-orm";

import { openRuntimeDb } from "../../db/client";
import {
  senderoEdges,
  senderoNodes,
  senderos,
  senderoVersions,
  agents,
} from "../../db/schema";
import type {
  SenderoGraph,
  SenderoRecord,
  SenderoVersionRecord,
} from "../../shared/types";

export async function getSenderoGraph(
  senderoId: string,
  version?: number,
  home?: string,
): Promise<SenderoGraph | null> {
  const db = openRuntimeDb(home);
  const sendero = ((
    await db.select().from(senderos).where(eq(senderos.id, senderoId))
  )[0] ??
    (
      await db.select().from(senderos).where(eq(senderos.slug, senderoId))
    )[0]) as SenderoRecord | undefined;

  if (!sendero) return null;

  const versions = (await db
    .select()
    .from(senderoVersions)
    .where(
      eq(senderoVersions.senderoId, sendero.id),
    )) as SenderoVersionRecord[];
  const selected = versions.find(
    (item) => item.version === (version ?? sendero.currentVersion),
  );

  if (!selected) return null;

  const graph: SenderoGraph = {
    sendero,
    version: selected,
    nodes: (await db
      .select()
      .from(senderoNodes)
      .where(eq(senderoNodes.senderoVersionId, selected.id))
      .orderBy(asc(senderoNodes.createdAt))) as SenderoGraph["nodes"],
    edges: (await db
      .select()
      .from(senderoEdges)
      .where(eq(senderoEdges.senderoVersionId, selected.id))
      .orderBy(asc(senderoEdges.createdAt))) as SenderoGraph["edges"],
  };
  // A draft version ID remains the same while its contents change. This token
  // lets a human-facing client fence the exact definition it reviewed without
  // requiring a separate mutable revision counter on every editing operation.
  const agentIds = [...new Set(graph.nodes.flatMap(node => node.agentId ? [node.agentId] : []))];
  const draftAgents = selected.status === "draft" && agentIds.length
    ? await db.select({ id: agents.id, name: agents.name, status: agents.status, instructions: agents.definitionBody, metadata: agents.defaultMetaJson }).from(agents).where(inArray(agents.id, agentIds))
    : [];
  graph.revision = createHash("sha256").update(JSON.stringify({
    version: graph.version,
    nodes: [...graph.nodes].sort((a, b) => a.id.localeCompare(b.id)),
    edges: [...graph.edges].sort((a, b) => a.id.localeCompare(b.id)),
    draftAgents: draftAgents.sort((a, b) => a.id.localeCompare(b.id)),
  })).digest("hex");
  return graph;
}
