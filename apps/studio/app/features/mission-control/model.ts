import type { MissionControlData } from "./server";

export type AttemptSnapshot = {
  evidence?: Array<{ id: string; label: string; kind: string; url?: string; summary?: string; createdAt?: string }>;
  review?: { status: string; reviewer?: string; rationale?: string; reviewedAt?: string };
};

export function parseAttemptSnapshot(value: string): AttemptSnapshot {
  try { return JSON.parse(value) as AttemptSnapshot; }
  catch { return {}; }
}

export function relativeTime(value?: string | null, now = Date.now()) {
  if (!value) return "Never";
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
