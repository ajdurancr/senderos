import { openRuntimeDb } from "../../db/client";
import { runs } from "../../db/schema";
import { asc } from "drizzle-orm";
import type { RunRecord } from "../../shared/types";
export async function listRuns(home?: string) {
  const db = openRuntimeDb(home);
  const rows = await db.select().from(runs).orderBy(asc(runs.createdAt));
  return rows as RunRecord[];
}
