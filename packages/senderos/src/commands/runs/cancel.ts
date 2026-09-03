import { openRuntimeDb } from '../../db/client';
import { emitEvent } from '../../shared/events';
import { now } from '../../shared/ids';
import { listRunAttempts } from '../attempts/list';
import { updateRunAttempt } from '../attempts/update';
import { cancelGoal } from '../goals/cancel';
import { getRun } from './get';
export function cancelRun(id: string, home?: string) { const db = openRuntimeDb(home); const run: any = db.query('select * from runs where id=?').get(id); if (!run) { db.close(); throw new Error(`Run not found: ${id}`); } db.prepare("update runs set status='canceled',updated_at=? where id=?").run(now(), id); db.close(); for (const attempt of listRunAttempts(id, home).filter((item) => ['queued', 'running', 'paused'].includes(item.status))) updateRunAttempt(attempt.id, { status: 'canceled', finishedAt: now(), failureSummary: 'Run canceled by Senderos.' }, home); const eventDb = openRuntimeDb(home); emitEvent(eventDb, 'run.canceled', 'run', id, {}); eventDb.close(); cancelGoal(run.goal_id, home); return getRun(id, home); }
