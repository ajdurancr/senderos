import { eq } from "drizzle-orm";

import { openRuntimeDb } from "../../db/client";
import { senderoNodes } from "../../db/schema";
import { emitEvent } from "../../shared/events";
import { now } from "../../shared/ids";

export async function updateSenderoNode(input: {
  id: string;
  label?: string;
  positionX?: number;
  positionY?: number;
  home?: string;
}) {
  const db = openRuntimeDb(input.home);
  const node = (
    await db.select().from(senderoNodes).where(eq(senderoNodes.id, input.id))
  )[0];

  if (!node) throw new Error(`Sendero node not found: ${input.id}`);

  await db
    .update(senderoNodes)
    .set({
      label: input.label ?? node.label,
      positionX: input.positionX ?? node.positionX,
      positionY: input.positionY ?? node.positionY,
      updatedAt: now(),
    })
    .where(eq(senderoNodes.id, input.id));
  await emitEvent(db, "sendero.node-updated", "sendero-node", input.id, {
    label: input.label,
  });

  return (
    await db.select().from(senderoNodes).where(eq(senderoNodes.id, input.id))
  )[0];
}
