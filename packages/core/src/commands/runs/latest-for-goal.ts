import { openRuntimeDb } from "../../db/client";
import { runs } from "../../db/schema";
import type { RunRecord } from "../../shared/types";
import { desc, eq } from "drizzle-orm";
export async function latestRunForGoal(
  goalId: string,
  home?: string,
): Promise<RunRecord | null> {
  const db = openRuntimeDb(home);
  const row = (
    await db
      .select()
      .from(runs)
      .where(eq(runs.goalId, goalId))
      .orderBy(desc(runs.createdAt))
      .limit(1)
  )[0];
  return (row as RunRecord | undefined) ?? null;
}
