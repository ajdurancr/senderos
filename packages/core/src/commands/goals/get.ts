import { openRuntimeDb } from "../../db/client";
import type { GoalRecord } from "../../shared/types";
import { goals } from "../../db/schema";
import { eq } from "drizzle-orm";

export async function getGoal(id: string, home?: string) {
  const db = openRuntimeDb(home);
  return (
    ((await db.select().from(goals).where(eq(goals.id, id)))[0] as
      | GoalRecord
      | undefined) ?? null
  );
}
