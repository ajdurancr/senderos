import { openRuntimeDb } from "../../db/client";
import { runs } from "../../db/schema";
import type { RunRecord } from "../../shared/types";
import { eq } from "drizzle-orm";
export async function getRun(
  id: string,
  home?: string,
): Promise<RunRecord | null> {
  const db = openRuntimeDb(home);
  const row = (await db.select().from(runs).where(eq(runs.id, id)))[0];
  return (row as RunRecord | undefined) ?? null;
}
