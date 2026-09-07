import { openRuntimeDb } from '../../db/client';
import { emitEvent } from '../../shared/events';
import { now } from '../../shared/ids';
import type { GoalKind } from '../../shared/types';
import { getGoal } from './get';
import { goals } from '../../db/schema';
import { eq } from 'drizzle-orm';

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
}) {
  const current = await getGoal(input.id, input.home);
  if (!current) throw new Error(`Goal not found: ${input.id}`);
  const db = openRuntimeDb(input.home);
  await db.update(goals).set({ title: input.title ?? current.title, kind: input.kind ?? current.kind, intakeText: input.intakeText ?? current.intakeText, specText: input.specText ?? current.specText, prUrl: input.prUrl === undefined ? current.prUrl : input.prUrl, prNumber: input.prNumber === undefined ? current.prNumber : input.prNumber, branchName: input.branchName === undefined ? current.branchName : input.branchName, updatedAt: now() }).where(eq(goals.id, input.id));
  await emitEvent(db, 'goal.updated', 'goal', input.id, input);
  return getGoal(input.id, input.home);
}
