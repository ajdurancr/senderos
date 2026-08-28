import { openRuntimeDb } from '../../../db/client';
import type { GoalRecord } from '../../../domain/types';
import { now, randomId } from '../../../utils/common';
import { emitEvent } from '../../events';

export function createRunRecord(goal:GoalRecord, home?:string) { const db=openRuntimeDb(home); const id=randomId('run'); db.prepare('insert into runs (id,goal_id,status,branch_name,base_branch,max_attempts,created_at,updated_at) values (?,?,?,?,?,?,?,?)').run(id,goal.id,'executing',goal.branchName,goal.baseTargetBranch,3,now(),now()); emitEvent(db,'run.created','run',id,{goalId:goal.id}); db.close(); return getRun(id,home); }
export function getRun(id:string,home?:string) { const db=openRuntimeDb(home); const row=db.query('select * from runs where id=?').get(id); db.close(); return row; }
export function latestRunForGoal(goalId:string,home?:string) { const db=openRuntimeDb(home); const row=db.query('select * from runs where goal_id=? order by created_at desc limit 1').get(goalId); db.close(); return row; }
