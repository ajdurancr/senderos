import { eq } from "drizzle-orm";

import { openRuntimeDb } from "../db/client";
import { agents, agentTransitions, senderoEdges, senderoNodes, senderos, senderoVersions } from "../db/schema";
import { emitEvent } from "../shared/events";

const timestamp = "2026-09-10T00:00:00.000Z";
const senderoId = "sendero-software-delivery";
const versionId = `${senderoId}-v1`;

export async function seedBuiltInSenderos(home?: string) {
  const db = openRuntimeDb(home);
  const agentRows = await db.select().from(agents);
  const bySlug = new Map(agentRows.map((agent) => [agent.slug, agent]));
  const required = ["spec-partner", "craftsman-lead", "tdd-craftsman", "mutation-tester", "judge"];
  if (required.some((slug) => !bySlug.has(slug))) return null;

  let created = false;
  if (!(await db.select().from(senderos).where(eq(senderos.id, senderoId)))[0]) {
    created = true;
    await db.insert(senderos).values({ id: senderoId, slug: "software-delivery", name: "Verified software delivery", description: "A complete trail from clarified intent through implementation, validation, and judgment.", status: "active", currentVersion: 1, createdAt: timestamp, updatedAt: timestamp });
    await db.insert(senderoVersions).values({ id: versionId, senderoId, version: 1, status: "published", createdAt: timestamp });
  }

  const definitions = [
    ["start", null, "start", "Requested outcome", 60, 220],
    ["spec", "spec-partner", "agent", "Clarify", 330, 220],
    ["craft", "craftsman-lead", "agent", "Frame handoff", 600, 80],
    ["tdd", "tdd-craftsman", "agent", "Implement", 870, 220],
    ["mutation", "mutation-tester", "agent", "Stress test", 1140, 80],
    ["judge", "judge", "agent", "Judge", 1410, 220],
    ["end", null, "end", "Verified outcome", 1680, 220],
  ] as const;
  for (const [key, slug, kind, label, positionX, positionY] of definitions) {
    const id = `${versionId}-node-${key}`;
    if (!(await db.select().from(senderoNodes).where(eq(senderoNodes.id, id)))[0])
      await db.insert(senderoNodes).values({ id, senderoVersionId: versionId, agentId: slug ? bySlug.get(slug)!.id : null, kind, label, positionX, positionY, createdAt: timestamp, updatedAt: timestamp });
  }

  const links = [
    ["begin", "start", "spec", null, "Begin with a durable specification."],
    ["spec-handoff", "spec", "craft", "spec-partner", "Hand the clarified outcome to the continuity steward."],
    ["implementation", "craft", "tdd", "craftsman-lead", "Prepare a focused implementation handoff."],
    ["validation", "tdd", "mutation", "tdd-craftsman", "Validate the implementation beyond the happy path."],
    ["judgment", "mutation", "judge", "mutation-tester", "Submit evidence and residual risks for judgment."],
    ["complete", "judge", "end", "judge", "Accept the verified outcome or return it for repair."],
  ] as const;
  for (const [key, source, target, sourceSlug, objective] of links) {
    const transitionId = sourceSlug ? `${versionId}-transition-${key}` : null;
    const sourceAgent = sourceSlug ? bySlug.get(sourceSlug)! : null;
    const targetNode = definitions.find((item) => item[0] === target)!;
    const targetAgent = targetNode[1] ? bySlug.get(targetNode[1])! : null;
    if (transitionId && !(await db.select().from(agentTransitions).where(eq(agentTransitions.id, transitionId)))[0])
      await db.insert(agentTransitions).values({ id: transitionId, sourceAgentId: sourceAgent!.id, targetAgentId: targetAgent?.id ?? null, name: key.replaceAll("-", " "), description: objective, status: "active", transitionObjective: objective, assignmentMetaJson: JSON.stringify({ senderoId, senderoVersionId: versionId }), createdAt: timestamp, updatedAt: timestamp });
    const edgeId = `${versionId}-edge-${key}`;
    if (!(await db.select().from(senderoEdges).where(eq(senderoEdges.id, edgeId)))[0])
      await db.insert(senderoEdges).values({ id: edgeId, senderoVersionId: versionId, sourceNodeId: `${versionId}-node-${source}`, targetNodeId: `${versionId}-node-${target}`, transitionId, name: key.replaceAll("-", " "), description: objective, transitionObjective: objective, conditionJson: "{}", status: "active", createdAt: timestamp, updatedAt: timestamp });
  }
  if (created) await emitEvent(db, "sendero.seeded", "sendero", senderoId, { version: 1 });
  return senderoId;
}
