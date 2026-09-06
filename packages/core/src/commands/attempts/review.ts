import { openRuntimeDb } from '../../db/client';
import { emitEvent } from '../../shared/events';
import { now } from '../../shared/ids';
import type { AttemptReview, ReviewStatus } from '../../shared/types';
import { getRunAttempt } from './get';
import { updateRunAttempt } from './update';

export function reviewRunAttempt(input: { attemptId: string; status: ReviewStatus; reviewer: string; rationale?: string; home?: string }) {
  const attempt = getRunAttempt(input.attemptId, input.home);
  if (!attempt) throw new Error(`Run attempt not found: ${input.attemptId}`);
  const snapshot = JSON.parse(attempt.statusSnapshotJson) as Record<string, unknown>;
  const review: AttemptReview = { status: input.status, reviewer: input.reviewer, ...(input.rationale ? { rationale: input.rationale } : {}), reviewedAt: now() };
  updateRunAttempt(input.attemptId, { statusSnapshot: { ...snapshot, review } }, input.home);
  const db = openRuntimeDb(input.home);
  emitEvent(db, 'run-attempt.reviewed', 'run-attempt', input.attemptId, review);
  db.close();
  return review;
}
