import type { MissionControlData } from "./server";

export type AttemptSnapshot = {
  evidence?: Array<{ id: string; label: string; kind: string; url?: string; summary?: string; createdAt?: string }>;
  review?: { status: string; reviewer?: string; rationale?: string; reviewedAt?: string };
};

export function parseAttemptSnapshot(value: string): AttemptSnapshot {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const snapshot = parsed as AttemptSnapshot;
    const text = (input: unknown) => typeof input === "string" ? input : undefined;
    return {
      evidence: Array.isArray(snapshot.evidence) ? snapshot.evidence.filter(item => item && typeof item.id === 'string' && typeof item.label === 'string' && typeof item.kind === 'string').map(item => ({ id: item.id, label: item.label, kind: item.kind, url: text(item.url), summary: text(item.summary), createdAt: text(item.createdAt) })) : undefined,
      review: snapshot.review && typeof snapshot.review === 'object' && typeof snapshot.review.status === 'string' ? { status: snapshot.review.status, reviewer: text(snapshot.review.reviewer), rationale: text(snapshot.review.rationale), reviewedAt: text(snapshot.review.reviewedAt) } : undefined,
    };
  }
  catch { return {}; }
}

export function relativeTime(value?: string | null, now = Date.now()) {
  if (!value) return "Never";
  if (!Number.isFinite(new Date(value).getTime())) return "Unknown";
  const seconds = Math.max(0, Math.floor((now - new Date(value).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function goalExecution(data: MissionControlData, goalId: string) {
  const runs = data.runs
    .filter((run) => run.goalId === goalId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const attempts = runs.flatMap((run) =>
    data.attempts
      .filter((attempt) => attempt.runId === run.id)
      .sort((a, b) => a.attemptNumber - b.attemptNumber),
  );
  return { runs, attempts, latestRun: runs.at(-1), latestAttempt: attempts.at(-1) };
}

export function eventLabel(value: string) {
  return value.replaceAll(".", " / ").replaceAll("-", " ");
}
