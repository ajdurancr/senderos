import { openRuntimeDb } from "../../db/client";
import { emitEvent } from "../../shared/events";
import { now, randomId } from "../../shared/ids";
import type { AttemptEvidence, EvidenceKind } from "../../shared/types";
import { getRunAttempt } from "./get";
import { updateRunAttempt } from "./update";

export async function recordAttemptEvidence(input: {
  attemptId: string;
  kind: EvidenceKind;
  label: string;
  url?: string;
  summary?: string;
  home?: string;
}) {
  const attempt = await getRunAttempt(input.attemptId, input.home);
  if (!attempt) throw new Error(`Run attempt not found: ${input.attemptId}`);
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
  await updateRunAttempt(
    input.attemptId,
    {
      statusSnapshot: {
        ...snapshot,
        evidence: [...evidence, item],
        review: snapshot.review ?? { status: "pending" },
      },
    },
    input.home,
  );
  const db = openRuntimeDb(input.home);
  await emitEvent(
    db,
    "run-attempt.evidence-recorded",
    "run-attempt",
    input.attemptId,
    item,
  );
  return item;
}
