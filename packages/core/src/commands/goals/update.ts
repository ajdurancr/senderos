import { openRuntimeDb } from '../../db/client';
import { emitEvent } from '../../shared/events';
import { now } from '../../shared/ids';
import type { GoalKind } from '../../shared/types';
import { getGoal } from './get';
import { sql } from 'drizzle-orm';

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
  await db.run(sql`update goals set title=${input.title ?? current.title},kind=${input.kind ?? current.kind},intake_text=${input.intakeText ?? current.intakeText},spec_text=${input.specText ?? current.specText},pr_url=${input.prUrl === undefined ? current.prUrl : input.prUrl},pr_number=${input.prNumber === undefined ? current.prNumber : input.prNumber},branch_name=${input.branchName === undefined ? current.branchName : input.branchName},updated_at=${now()} where id=${input.id}`);
  await emitEvent(db, 'goal.updated', 'goal', input.id, input);
  return getGoal(input.id, input.home);
}
