import { requireAttempt } from "../../lifecycle/scope";
import { runAttempts } from "../../db/schema";
import { eq } from "drizzle-orm";
import { settleGate } from "../../lifecycle/gates";
import { requireLifecycle } from "../../lifecycle/errors";
import { terminal } from "../../lifecycle/state";
import { atomic, openRuntimeDb } from "../../db/client";
import { emitEvent } from "../../shared/events";
import { now, randomId } from "../../shared/ids";
import type { AttemptEvidence, EvidenceKind } from "../../shared/types";

export async function recordAttemptEvidence(input: {
  attemptId: string;
  kind: EvidenceKind;
  label: string;
  url?: string;
  summary?: string;
  home?: string;
}) {
  return atomic(input.home, async () => {
    const attempt = await requireAttempt(input.attemptId, input.home);
    requireLifecycle(
      ["test", "ci", "pull_request", "artifact", "manual"].includes(
        input.kind,
      ) && input.label.trim().length > 0,
      "INVALID_INPUT",
      "Valid evidence kind and nonempty label are required",
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
    const evidence = Array.isArray(snapshot.evidence)
      ? (snapshot.evidence as AttemptEvidence[])
      : [];
    const item: AttemptEvidence = {
      id: randomId("evidence"),
      kind: input.kind,
      label: input.label,
      ...(input.url ? { url: input.url } : {}),
      ...(input.summary ? { summary: input.summary } : {}),
      createdAt: now(),
    };
    await openRuntimeDb(input.home)
      .update(runAttempts)
      .set({
        statusSnapshotJson: JSON.stringify({
          ...snapshot,
          evidence: [...evidence, item],
          review: snapshot.review ?? { status: "pending" },
        }),
      })
      .where(eq(runAttempts.id, input.attemptId));
    await settleGate(input.attemptId, input.home);
    const db = openRuntimeDb(input.home);
    await emitEvent(
      db,
      "run-attempt.evidence-recorded",
      "run-attempt",
      input.attemptId,
      item,
    );
    return item;
  });
}
