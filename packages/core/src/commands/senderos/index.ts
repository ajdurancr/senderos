import { asc, eq } from "drizzle-orm";

import { openRuntimeDb } from "../../db/client";
import { agentTransitions, senderoEdges, senderoNodes, senderos, senderoVersions } from "../../db/schema";
import { emitEvent } from "../../shared/events";
import { now } from "../../shared/ids";
import type { SenderoGraph, SenderoRecord, SenderoVersionRecord } from "../../shared/types";

export async function listSenderos(home?: string): Promise<SenderoRecord[]> {
  return (await openRuntimeDb(home).select().from(senderos).orderBy(asc(senderos.createdAt))) as SenderoRecord[];
}

export async function listSenderoVersions(home?: string): Promise<SenderoVersionRecord[]> {
  return (await openRuntimeDb(home).select().from(senderoVersions).orderBy(asc(senderoVersions.createdAt))) as SenderoVersionRecord[];
}

export async function getSenderoGraph(senderoId: string, version?: number, home?: string): Promise<SenderoGraph | null> {
  const db = openRuntimeDb(home);
  const sendero = ((await db.select().from(senderos).where(eq(senderos.id, senderoId)))[0] ??
    (await db.select().from(senderos).where(eq(senderos.slug, senderoId)))[0]) as SenderoRecord | undefined;
  if (!sendero) return null;
  const versions = (await db.select().from(senderoVersions).where(eq(senderoVersions.senderoId, sendero.id))) as SenderoVersionRecord[];
  const selected = versions.find((item) => item.version === (version ?? sendero.currentVersion));
  if (!selected) return null;
  return {
    sendero,
    version: selected,
    nodes: await db.select().from(senderoNodes).where(eq(senderoNodes.senderoVersionId, selected.id)).orderBy(asc(senderoNodes.createdAt)) as SenderoGraph["nodes"],
    edges: await db.select().from(senderoEdges).where(eq(senderoEdges.senderoVersionId, selected.id)).orderBy(asc(senderoEdges.createdAt)) as SenderoGraph["edges"],
  };
}

export async function listSenderoGraphs(home?: string) {
  const records = await listSenderos(home);
  return (await Promise.all(records.map((item) => getSenderoGraph(item.id, undefined, home)))).filter(Boolean) as SenderoGraph[];
}

export async function updateSenderoNodePosition(input: { id: string; positionX: number; positionY: number; home?: string }) {
  const db = openRuntimeDb(input.home);
  const node = (await db.select().from(senderoNodes).where(eq(senderoNodes.id, input.id)))[0];
  if (!node) throw new Error(`Sendero node not found: ${input.id}`);
  await db.update(senderoNodes).set({ positionX: Math.round(input.positionX), positionY: Math.round(input.positionY), updatedAt: now() }).where(eq(senderoNodes.id, input.id));
  await emitEvent(db, "sendero.node-position-updated", "sendero-node", input.id, { positionX: input.positionX, positionY: input.positionY });
  return (await db.select().from(senderoNodes).where(eq(senderoNodes.id, input.id)))[0];
}

export async function updateSenderoNode(input: { id: string; label?: string; positionX?: number; positionY?: number; home?: string }) {
  const db = openRuntimeDb(input.home);
  const node = (await db.select().from(senderoNodes).where(eq(senderoNodes.id, input.id)))[0];
  if (!node) throw new Error(`Sendero node not found: ${input.id}`);
  await db.update(senderoNodes).set({ label: input.label ?? node.label, positionX: input.positionX ?? node.positionX, positionY: input.positionY ?? node.positionY, updatedAt: now() }).where(eq(senderoNodes.id, input.id));
  await emitEvent(db, "sendero.node-updated", "sendero-node", input.id, { label: input.label });
  return (await db.select().from(senderoNodes).where(eq(senderoNodes.id, input.id)))[0];
}

export async function updateSenderoEdge(input: { id: string; name?: string; description?: string; transitionObjective?: string; status?: "draft" | "active" | "disabled" | "archived"; home?: string }) {
  const db = openRuntimeDb(input.home);
  const edge = (await db.select().from(senderoEdges).where(eq(senderoEdges.id, input.id)))[0];
  if (!edge) throw new Error(`Sendero edge not found: ${input.id}`);
  await db.update(senderoEdges).set({ name: input.name ?? edge.name, description: input.description ?? edge.description, transitionObjective: input.transitionObjective ?? edge.transitionObjective, status: input.status ?? edge.status, updatedAt: now() }).where(eq(senderoEdges.id, input.id));
  if (edge.transitionId) await db.update(agentTransitions).set({ name: input.name ?? edge.name, description: input.description ?? edge.description, transitionObjective: input.transitionObjective ?? edge.transitionObjective, status: input.status ?? edge.status, updatedAt: now() }).where(eq(agentTransitions.id, edge.transitionId));
  await emitEvent(db, "sendero.edge-updated", "sendero-edge", input.id, { name: input.name, status: input.status });
  return (await db.select().from(senderoEdges).where(eq(senderoEdges.id, input.id)))[0];
}
