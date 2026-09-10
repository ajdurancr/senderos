import { openRuntimeDb } from "../../db/client";
import { emitEvent } from "../../shared/events";
import { now, randomId } from "../../shared/ids";
import type { GoalRecord } from "../../shared/types";
import { getRun } from "./get";
import { runs } from "../../db/schema";
import { getSenderoGraph } from "../senderos";
export async function createRunRecord(goal: GoalRecord, home?: string) {
  const db = openRuntimeDb(home);
  const id = randomId("run");
  const ts = now();
  const graph = goal.senderoVersionId
    ? await graphForVersion(goal.senderoVersionId, home)
    : null;
  await db
    .insert(runs)
    .values({
      id,
      goalId: goal.id,
      status: "executing",
      branchName: goal.branchName,
      baseBranch: goal.baseTargetBranch,
      maxAttempts: 3,
      senderoVersionId: goal.senderoVersionId,
      senderoSnapshotJson: JSON.stringify(graph ?? {}),
      createdAt: ts,
      updatedAt: ts,
    });
  await emitEvent(db, "run.created", "run", id, { goalId: goal.id });
  return getRun(id, home);
}

async function graphForVersion(versionId: string, home?: string) {
  const db = openRuntimeDb(home);
  const version = (await db.query.senderoVersions.findFirst({ where: (table, { eq }) => eq(table.id, versionId) }));
  return version ? getSenderoGraph(version.senderoId, version.version, home) : null;
}
