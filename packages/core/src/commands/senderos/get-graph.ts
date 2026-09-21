import { asc, eq } from "drizzle-orm";

import { openRuntimeDb } from "../../db/client";
import {
  senderoEdges,
  senderoNodes,
  senderos,
  senderoVersions,
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

  return {
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
}
