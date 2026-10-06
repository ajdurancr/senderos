import { requireAttempt } from "../../lifecycle/scope";
import { runAttempts } from "../../db/schema";
import { eq } from "drizzle-orm";
import { settleGate } from "../../lifecycle/gates";
import { requireLifecycle } from "../../lifecycle/errors";
import { terminal } from "../../lifecycle/state";
import { atomic, openRuntimeDb } from "../../db/client";
import { emitEvent } from "../../shared/events";
import { now } from "../../shared/ids";
import type { AttemptReview, ReviewStatus } from "../../shared/types";

export async function reviewRunAttempt(input: {
  attemptId: string;
  status: ReviewStatus;
  reviewer: string;
  rationale?: string;
  home?: string;
}) {
  return atomic(input.home, async () => {
    const attempt = await requireAttempt(input.attemptId, input.home);
    requireLifecycle(
      ["pending", "approved", "changes_requested", "rejected"].includes(
        input.status,
      ) && input.reviewer.trim().length > 0,
      "INVALID_INPUT",
      "Valid review status and reviewer are required",
    );
    requireLifecycle(
      !terminal(attempt.status),
      "TERMINAL_ATTEMPT",
      "Finished attempts cannot be changed",
    );
    const snapshot = JSON.parse(attempt.statusSnapshotJson) as Record<
      string,
      unknown
    >;
    const review: AttemptReview = {
      status: input.status,
      reviewer: input.reviewer,
      ...(input.rationale ? { rationale: input.rationale } : {}),
      reviewedAt: now(),
    };
    await openRuntimeDb(input.home)
      .update(runAttempts)
      .set({ statusSnapshotJson: JSON.stringify({ ...snapshot, review }) })
      .where(eq(runAttempts.id, input.attemptId));
    await settleGate(input.attemptId, input.home);
    const db = openRuntimeDb(input.home);
    await emitEvent(
      db,
      "run-attempt.reviewed",
      "run-attempt",
      input.attemptId,
      review,
    );
    return review;
  });
}
