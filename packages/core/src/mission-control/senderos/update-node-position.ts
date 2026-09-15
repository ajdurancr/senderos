import { eq } from "drizzle-orm";

import { openRuntimeDb } from "../../db/client";
import { senderoNodes } from "../../db/schema";
import { now } from "../../shared/ids";

export async function updateSenderoNodePosition(input: {
  id: string;
  positionX: number;
  positionY: number;
  home?: string;
}) {
  const db = openRuntimeDb(input.home);
  const node = (
    await db.select().from(senderoNodes).where(eq(senderoNodes.id, input.id))
  )[0];

  if (!node) throw new Error(`Sendero node not found: ${input.id}`);

  const positionX = Math.round(input.positionX);
  const positionY = Math.round(input.positionY);
  await db
    .update(senderoNodes)
    .set({ positionX, positionY, updatedAt: now() })
    .where(eq(senderoNodes.id, input.id));
  return (
    await db.select().from(senderoNodes).where(eq(senderoNodes.id, input.id))
  )[0];
}
