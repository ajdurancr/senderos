import { readdirSync, readFileSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";

import { openRuntimeDb } from "../db/client";
import {
  agents,
  senderoEdges,
  senderoNodes,
  senderos,
  senderoVersions,
} from "../db/schema";
import { emitEvent } from "../shared/events";
import type { SenderoNodeKind } from "../shared/types";

const timestamp = "2026-09-11T00:00:00.000Z";

type NodeDefinition = {
  key: string;
  kind: SenderoNodeKind;
  label: string;
  agentSlug?: string;
  x: number;
  y: number;
};

type EdgeDefinition = {
  key: string;
  source: string;
  target: string;
  sourceAgentSlug?: string;
  name: string;
  objective: string;
};

type SenderoDefinition = {
  id: string;
  slug: string;
  name: string;
  description: string;
  default?: boolean;
  nodes: NodeDefinition[];
  edges: EdgeDefinition[];
};

export function builtInSenderoSeedDir() {
  return resolve(dirname(fileURLToPath(import.meta.url)), "./senderos");
}

function loadDefinitions(directory = builtInSenderoSeedDir()) {
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && extname(entry.name) === ".json")
    .map(
      (entry) =>
        JSON.parse(
          readFileSync(resolve(directory, entry.name), "utf8"),
        ) as SenderoDefinition,
    )
    .sort(
      (left, right) =>
        Number(Boolean(right.default)) - Number(Boolean(left.default)),
    );
}

export async function seedBuiltInSenderos(home?: string) {
  const db = openRuntimeDb(home);
  const agentRows = await db.select().from(agents);
  const agentsBySlug = new Map(agentRows.map((agent) => [agent.slug, agent]));
  const seeded: string[] = [];

  for (const definition of loadDefinitions()) {
    const missingAgent = definition.nodes
      .map((node) => node.agentSlug)
      .find((slug) => slug && !agentsBySlug.has(slug));
    if (missingAgent) {
      throw new Error(
        `Sendero ${definition.slug} references missing agent: ${missingAgent}`,
      );
    }

    const versionId = `${definition.id}-v1`;
    const existing = (
      await db.select().from(senderos).where(eq(senderos.id, definition.id))
    )[0];

    if (!existing) {
      await db.insert(senderos).values({
        id: definition.id,
        slug: definition.slug,
        name: definition.name,
        description: definition.description,
        status: "active",
        isDefault: definition.default ?? false,
        currentVersion: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      await emitEvent(db, "sendero.seeded", "sendero", definition.id, {
        version: 1,
      });
    }

    if (
      !(
        await db
          .select()
          .from(senderoVersions)
          .where(eq(senderoVersions.id, versionId))
      )[0]
    ) {
      await db.insert(senderoVersions).values({
        id: versionId,
        senderoId: definition.id,
        version: 1,
        status: "published",
        createdAt: timestamp,
      });
    }

    for (const node of definition.nodes) {
      const id = `${versionId}-node-${node.key}`;
      if (
        (await db.select().from(senderoNodes).where(eq(senderoNodes.id, id)))[0]
      )
        continue;

      await db.insert(senderoNodes).values({
        id,
        senderoVersionId: versionId,
        agentId: node.agentSlug ? agentsBySlug.get(node.agentSlug)!.id : null,
        kind: node.kind,
        label: node.label,
        positionX: node.x,
        positionY: node.y,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }

    for (const edge of definition.edges) {
      const targetNode = definition.nodes.find(
        (node) => node.key === edge.target,
      );
      if (!targetNode) {
        throw new Error(
          `Sendero ${definition.slug} has an invalid target: ${edge.target}`,
        );
      }
      const edgeId = `${versionId}-edge-${edge.key}`;
      if (
        (
          await db
            .select()
            .from(senderoEdges)
            .where(eq(senderoEdges.id, edgeId))
        )[0]
      )
        continue;

      await db.insert(senderoEdges).values({
        id: edgeId,
        senderoVersionId: versionId,
        sourceNodeId: `${versionId}-node-${edge.source}`,
        targetNodeId: `${versionId}-node-${edge.target}`,
        name: edge.name,
        description: edge.objective,
        transitionObjective: edge.objective,
        conditionJson: "{}",
        status: "active",
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }

    seeded.push(definition.id);
  }

  return seeded;
}
