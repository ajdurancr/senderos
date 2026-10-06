import { requireGoal } from "../../lifecycle/scope";
import { requireLifecycle } from "../../lifecycle/errors";
import { atomic, openRuntimeDb } from "../../db/client";
import { emitEvent } from "../../shared/events";
import { now } from "../../shared/ids";
import type { GoalKind } from "../../shared/types";
import { getGoal } from "./get";
import { goals, senderoVersions } from "../../db/schema";
import { eq } from "drizzle-orm";

export async function updateGoal(input: {
  home?: string;
  id: string;
  title?: string;
  kind?: GoalKind;
  specText?: string;
  intakeText?: string;
  prUrl?: string | null;
  prNumber?: number | null;
  branchName?: string | null;
  senderoVersionId?: string | null;
}) {
  return atomic(input.home, async () => {
  const current = await requireGoal(input.id, input.home);
  if (!current) throw new Error(`Goal not found: ${input.id}`);
  requireLifecycle(input.senderoVersionId === undefined || (current.status === "draft"), "IMMUTABLE_WORKFLOW", "An activated goal cannot switch its pinned Sendero");
  const db = openRuntimeDb(input.home);
  requireLifecycle(input.title === undefined || input.title.trim().length > 0, 'INVALID_INPUT', 'Goal title must not be empty');
  if (input.senderoVersionId) {
    const version = (await db.select().from(senderoVersions).where(eq(senderoVersions.id, input.senderoVersionId)))[0];
    requireLifecycle(version?.status === 'published', 'INVALID_WORKFLOW', 'Select a published Sendero version');
  }
  await db
    .update(goals)
    .set({
      title: input.title ?? current.title,
      kind: input.kind ?? current.kind,
      intakeText: input.intakeText ?? current.intakeText,
      specText: input.specText ?? current.specText,
      prUrl: input.prUrl === undefined ? current.prUrl : input.prUrl,
      prNumber:
        input.prNumber === undefined ? current.prNumber : input.prNumber,
      branchName:
        input.branchName === undefined ? current.branchName : input.branchName,
      senderoVersionId:
        input.senderoVersionId === undefined ? current.senderoVersionId : input.senderoVersionId,
      updatedAt: now(),
    })
    .where(eq(goals.id, input.id));
  await emitEvent(db, "goal.updated", "goal", input.id, input);
  return getGoal(input.id, input.home);
  });
}
