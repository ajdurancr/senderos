import { openRuntimeDb } from "../../db/client";
import { emitEvent } from "../../shared/events";
import { now, randomId } from "../../shared/ids";
import type { GoalRecord } from "../../shared/types";
import { getRun } from "./get";
import { runs } from "../../db/schema";
export async function createRunRecord(goal: GoalRecord, home?: string) {
  const db = openRuntimeDb(home);
  const id = randomId("run");
  const ts = now();
  await db.insert(runs).values({
    id,
    goalId: goal.id,
    status: "executing",
    branchName: goal.branchName,
    baseBranch: goal.baseTargetBranch,
    maxAttempts: 3,
    senderoVersionId: goal.senderoVersionId,
    createdAt: ts,
    updatedAt: ts,
  });
  await emitEvent(db, "run.created", "run", id, { goalId: goal.id });
  return getRun(id, home);
}
