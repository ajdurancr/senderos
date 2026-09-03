import type { GoalKind, GoalRecord } from '../shared/types';
import { openRuntimeDb } from '../db/client';
import { mapGoalRow, mapProjectRow } from '../db/mappers';
import { now, randomId } from '../shared/ids';
import { emitEvent } from '../shared/events';
function requireProject(projectId: string, home?: string) {
  const db = openRuntimeDb(home);
  const p = mapProjectRow(
    db.query('select * from projects where id=?').get(projectId),
  );
  db.close();
  if (!p) throw new Error(`Project not found: ${projectId}`);
  return p;
}
export function createGoal(input: {
  home?: string;
  projectId: string;
  title: string;
  kind?: GoalKind;
  specText?: string;
  intakeText?: string;
  id?: string;
}) {
  const project = requireProject(input.projectId, input.home);
  const db = openRuntimeDb(input.home);
  const id = input.id ?? randomId('goal');
  const ts = now();
  db.prepare(
    'insert into goals (id,project_id,title,kind,intake_text,spec_text,status,base_target_branch,branch_name,pr_url,pr_number,created_at,updated_at) values (?,?,?,?,?,?,?,?,?,?,?,?,?)',
  ).run(
    id,
    input.projectId,
    input.title,
    input.kind ?? 'feature',
    input.intakeText ?? '',
    input.specText ?? '',
    'draft',
    project.targetBranch,
    null,
    null,
    null,
    ts,
    ts,
  );
  emitEvent(db, 'goal.created', 'goal', id, { projectId: input.projectId });
  db.close();
  return getGoal(id, input.home)!;
}
export function listGoals(home?: string): GoalRecord[] {
  const db = openRuntimeDb(home);
  const rows = db
    .query('select * from goals order by created_at asc')
    .all()
    .map(mapGoalRow) as GoalRecord[];
  db.close();
  return rows;
}
export function getGoal(id: string, home?: string) {
  const db = openRuntimeDb(home);
  const row = mapGoalRow(db.query('select * from goals where id=?').get(id));
  db.close();
  return row;
}
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
  const c = getGoal(input.id, input.home);
  if (!c) throw new Error(`Goal not found: ${input.id}`);
  const db = openRuntimeDb(input.home);
  db.prepare(
    'update goals set title=?,kind=?,intake_text=?,spec_text=?,pr_url=?,pr_number=?,branch_name=?,updated_at=? where id=?',
  ).run(
    input.title ?? c.title,
    input.kind ?? c.kind,
    input.intakeText ?? c.intakeText,
    input.specText ?? c.specText,
    input.prUrl === undefined ? c.prUrl : input.prUrl,
    input.prNumber === undefined ? c.prNumber : input.prNumber,
    input.branchName === undefined ? c.branchName : input.branchName,
    now(),
    input.id,
  );
  emitEvent(db, 'goal.updated', 'goal', input.id, input);
  db.close();
  return getGoal(input.id, input.home);
}
export function activateGoal(id: string, home?: string) {
  if (!getGoal(id, home)) throw new Error(`Goal not found: ${id}`);
  const db = openRuntimeDb(home);
  db.prepare("update goals set status='active',updated_at=? where id=?").run(
    now(),
    id,
  );
  emitEvent(db, 'goal.activated', 'goal', id, {});
  db.close();
  return getGoal(id, home);
}
export function cancelGoal(id: string, home?: string) {
  if (!getGoal(id, home)) throw new Error(`Goal not found: ${id}`);
  const db = openRuntimeDb(home);
  db.prepare("update goals set status='canceled',updated_at=? where id=?").run(
    now(),
    id,
  );
  db.prepare(
    "update runs set status='canceled',updated_at=? where goal_id=? and status not in ('succeeded','failed','canceled')",
  ).run(now(), id);
  db.prepare(
    "update run_attempts set status='canceled',finished_at=?,updated_at=? where run_id in (select id from runs where goal_id=?) and status in ('queued','running','paused')",
  ).run(now(), now(), id);
  emitEvent(db, 'goal.canceled', 'goal', id, {});
  db.close();
  return getGoal(id, home);
}
