import { openRuntimeDb } from "../../db/client";
import type { RunAttemptRecord } from "../../shared/types";
import { runAttempts } from "../../db/schema";
import { eq } from "drizzle-orm";

export async function getRunAttempt(id: string, home?: string) {
  const db = openRuntimeDb(home);
  return (
    ((await db.select().from(runAttempts).where(eq(runAttempts.id, id)))[0] as
      | RunAttemptRecord
      | undefined) ?? null
  );
}
