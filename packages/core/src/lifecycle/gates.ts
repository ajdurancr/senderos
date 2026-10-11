import { AsyncLocalStorage } from "node:async_hooks";
import { updateRunAttempt } from "../commands/attempts/update";
import { requireAttempt } from "./scope";
const settling = new AsyncLocalStorage<boolean>();
export function isSettlingGate() { return settling.getStore() === true; }
export async function settleGate(attemptId: string, home?: string) {
  const attempt = await requireAttempt(attemptId, home);
  const snapshot = JSON.parse(attempt.statusSnapshotJson);
  if (attempt.status !== "paused" || !snapshot.completionRequested) return;
  await settling.run(true, () => updateRunAttempt(attemptId, {
    status: ["rejected", "changes_requested"].includes(snapshot.review?.status) ? "failed" : "succeeded",
  }, home));
}
