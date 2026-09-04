import { openRuntimeDb } from '../../db/client';
import { emitEvent } from '../../shared/events';
import { now } from '../../shared/ids';
import type { GoalKind } from '../../shared/types';
import { getGoal } from './get';

export function updateGoal(input: {
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
  const current = getGoal(input.id, input.home);
  if (!current) throw new Error(`Goal not found: ${input.id}`);
  const db = openRuntimeDb(input.home);
  db.prepare(
    'update goals set title=?,kind=?,intake_text=?,spec_text=?,pr_url=?,pr_number=?,branch_name=?,updated_at=? where id=?',
  ).run(
    input.title ?? current.title,
    input.kind ?? current.kind,
    input.intakeText ?? current.intakeText,
    input.specText ?? current.specText,
    input.prUrl === undefined ? current.prUrl : input.prUrl,
    input.prNumber === undefined ? current.prNumber : input.prNumber,
    input.branchName === undefined ? current.branchName : input.branchName,
    now(),
    input.id,
  );
  emitEvent(db, 'goal.updated', 'goal', input.id, input);
  db.close();
  return getGoal(input.id, input.home);
}
