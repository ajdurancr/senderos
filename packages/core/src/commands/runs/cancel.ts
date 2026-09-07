import { openRuntimeDb } from "../../db/client";
import { emitEvent } from "../../shared/events";
import { now } from "../../shared/ids";
import { listRunAttempts } from "../attempts/list";
import { updateRunAttempt } from "../attempts/update";
import { cancelGoal } from "../goals/cancel";
import { getRun } from "./get";
import { runs } from "../../db/schema";
import { eq } from "drizzle-orm";
export async function cancelRun(id: string, home?: string) {
  const db = openRuntimeDb(home);
  const run = (await db.select().from(runs).where(eq(runs.id, id)))[0];
  /* c8 ignore next 3 -- exercised branch is not attributed by Bun's coverage output. */
  if (!run) {
    throw new Error(`Run not found: ${id}`);
  }
  await db
    .update(runs)
    .set({ status: "canceled", updatedAt: now() })
    .where(eq(runs.id, id));
  for (const attempt of (await listRunAttempts(id, home)).filter((item) =>
    ["queued", "running", "paused"].includes(item.status),
  ))
    await updateRunAttempt(
      attempt.id,
      {
        status: "canceled",
        finishedAt: now(),
        failureSummary: "Run canceled by Senderos.",
      },
      home,
    );
  await emitEvent(db, "run.canceled", "run", id, {});
  await cancelGoal(run.goalId, home);
  return getRun(id, home);
}
