import { openRuntimeDb } from '../../db/client';
import { mapProjectRow } from '../../db/mappers';
import { emitEvent } from '../../shared/events';
import { now, randomId } from '../../shared/ids';
import type { GoalKind } from '../../shared/types';
import { getGoal } from './get';
import { sql } from 'drizzle-orm';

async function requireProject(projectId: string, home?: string) {
  const db = openRuntimeDb(home);
  const project = mapProjectRow((await db.all(sql`select * from projects where id=${projectId}`))[0]);
  if (!project) throw new Error(`Project not found: ${projectId}`);
  return project;
}
export async function createGoal(input: {
  home?: string;
  projectId: string;
  title: string;
  kind?: GoalKind;
  specText?: string;
  intakeText?: string;
  id?: string;
}) {
  const project = await requireProject(input.projectId, input.home);
  const db = openRuntimeDb(input.home);
  const id = input.id ?? randomId('goal');
  const ts = now();
  await db.run(sql`insert into goals (id,project_id,title,kind,intake_text,spec_text,status,base_target_branch,branch_name,pr_url,pr_number,created_at,updated_at) values (${id},${input.projectId},${input.title},${input.kind ?? 'feature'},${input.intakeText ?? ''},${input.specText ?? ''},${'draft'},${project.targetBranch},${null},${null},${null},${ts},${ts})`);
  await emitEvent(db, 'goal.created', 'goal', id, { projectId: input.projectId });
  return (await getGoal(id, input.home))!;
}
